import { identityFromAnalysis } from "@/lib/email/identity-from-analysis";
import { effectiveIntentFromAnalysis } from "@/lib/email/effective-intent";
import {
  gatherFactsFromAnalysis,
  resolveOutboundSoapAttachment,
} from "@/lib/email/execute-system-actions";
import {
  enrichFactsForReply,
  processPatientTurn,
} from "@/lib/email/process-patient-turn";
import {
  detectPatientLanguage,
  resolveReplyLanguage,
} from "@/lib/i18n/patient-language";
import { analyzePatientMessage } from "@/lib/openai/analyze-patient-message";
import { generateReply } from "@/lib/openai/reply";
import {
  findNearestLocation,
  getUpcomingAppointment,
  listLocations,
  listServices,
} from "@/lib/supabase/clinical-queries";
import { gatherSoapNoteFacts } from "@/lib/email/soap-facts";
import { buildSoapNotePdf, soapNotePdfFilename } from "@/lib/email/soap-pdf";
import {
  appendResolutionPrompt,
  handleEmailFeedbackTurn,
  threadFeedbackStage,
  updateThreadFeedbackStage,
} from "@/lib/supabase/thread-feedback";
import {
  getThread,
  getThreadMessages,
  logOutboundMessage,
  updateThread,
} from "@/lib/supabase/email-store";
import {
  fetchReceivedEmail,
  sendReply,
  type EmailAttachment,
} from "@/lib/resend/client";
import {
  buildFactsEnvelope,
  isPublicReadonlyIntent,
  isVerificationDisabled,
} from "./phi-policy";
import { detectPublicReplyScope } from "./public-scope";
import { resolvePatientOptional } from "./resolve-patient";
import type {
  ClassificationResult,
  EmailIntent,
  EmailMessage,
  EmailThread,
  InboundEmailPayload,
  PatientLanguage,
  ProcessorFacts,
  ThreadStatus,
} from "@/lib/types";

export async function processInboundEmail(
  payload: InboundEmailPayload,
  thread: EmailThread
): Promise<void> {
  const history = await getThreadMessages(thread.id);
  const patientBodies = [
    ...history
      .filter((m) => m.direction === "inbound" && m.body_text)
      .map((m) => m.body_text as string),
    payload.text,
  ];
  const lang = detectPatientLanguage(...patientBodies);

  const feedbackStage = threadFeedbackStage(thread);
  if (feedbackStage === "awaiting_resolution" || feedbackStage === "awaiting_rating") {
    const feedbackTurn = await handleEmailFeedbackTurn(thread, payload.text, lang);
    if (feedbackTurn.handled) {
      await sendReplyAndUpdateThread(
        payload,
        thread,
        thread.last_intent ?? "unknown",
        { replyLanguage: lang },
        thread.status,
        thread.verified_patient_id,
        history,
        { replyText: feedbackTurn.replyText }
      );
      return;
    }
  }

  const noVerification = isVerificationDisabled();

  if (noVerification) {
    const turn = await processPatientTurn({
      thread,
      patientMessage: payload.text,
      subject: payload.subject,
      fromEmail: extractEmail(payload.from),
      history,
      replyChannel: "email",
    });
    if (
      turn.analysis.shouldAskResolutionFeedback &&
      feedbackStage === "none"
    ) {
      await updateThreadFeedbackStage(thread.id, "awaiting_resolution");
    }
    await sendReplyAndUpdateThread(
      payload,
      thread,
      turn.intent,
      turn.facts,
      "active",
      turn.patientId ?? thread.verified_patient_id,
      history,
      {
        replyText: turn.replyText,
        analysis: turn.analysis,
        replyLanguage: turn.facts.replyLanguage,
      }
    );
    return;
  }

  const analysis = await analyzePatientMessage(
    payload.subject,
    payload.text,
    thread,
    history,
    { threadIdForUsage: thread.id }
  );

  const classification = analysis;
  const intent = effectiveIntentFromAnalysis(analysis, thread);

  // Production path with verification (DISABLE_PATIENT_VERIFICATION=false)
  const { resolveIdentity } = await import("./identity");
  const { requiresVerification } = await import("./phi-policy");

  const claimsAlternateEmail = classification.intent === "alternate_email";
  const replyLanguage = resolveReplyLanguage(
    classification,
    payload.text,
    patientBodies
  );

  let facts: ProcessorFacts = { replyLanguage };
  let status: ThreadStatus = thread.status;

  const enrichFromAnalysis = (
    base: ProcessorFacts,
    identityHints: ReturnType<typeof identityFromAnalysis>,
    resolvedPatientId: string | null,
    patientName?: string | null
  ): ProcessorFacts =>
    enrichFactsForReply(base, {
      analysis: classification,
      intent,
      replyLanguage,
      identityHints: {
        name: identityHints.name,
        dob: identityHints.dob,
      },
      resolvedPatientId,
      patientName,
      replyChannel: "email",
    });

  const publicIdentityHints = identityFromAnalysis(classification, {
    patientBodies,
  });

  if (isPublicReadonlyIntent(intent)) {
    facts = enrichFromAnalysis(
      await gatherFactsFromAnalysis(classification, {
        patientId: null,
        body: payload.text,
        identityHints: publicIdentityHints,
        dbError: null,
        locationHint: classification.extractedLocationHint,
        encounterDateHint: classification.extractedEncounterDate,
      }),
      publicIdentityHints,
      thread.verified_patient_id
    );
    status = "active";
  } else {
    const identityHints = identityFromAnalysis(classification, {
      patientBodies,
    });

    const identity = await resolveIdentity(
      extractEmail(payload.from),
      identityHints.name,
      identityHints.dob,
      thread,
      claimsAlternateEmail
    );

    if (identity.verificationFailed) {
      status = "unknown_sender";
      facts = { verificationFailed: true, alternateEmail: true };
    } else if (identity.needsAlternateVerification) {
      status = "needs_dob";
      facts = {
        needsDob: !identity.dobVerified,
        needsName: !identity.nameMatched,
        alternateEmail: true,
      };
    } else if (!identity.patient) {
      status = "unknown_sender";
      facts = { unknownSender: true };
    } else if (requiresVerification(intent) && !identity.verifiedPatientId) {
      status = "needs_dob";
      facts = {
        needsDob: !identity.dobVerified,
        needsName: !identity.nameMatched,
        patientName: identity.patient.fullName,
        alternateEmail: identity.verifiedViaAlternateEmail,
      };
    } else if (identity.verifiedPatientId && identity.patient) {
      status = "verified";
      facts = enrichFromAnalysis(
        await gatherFactsFromAnalysis(classification, {
          patientId: identity.verifiedPatientId,
          body: payload.text,
          identityHints,
          dbError: null,
          locationHint: classification.extractedLocationHint,
          encounterDateHint: classification.extractedEncounterDate,
        }),
        identityHints,
        identity.verifiedPatientId,
        identity.patient.fullName
      );
    }

    facts = buildFactsEnvelope(intent, identity, facts);
    await sendReplyAndUpdateThread(
      payload,
      thread,
      intent,
      facts,
      status,
      identity.verifiedPatientId ?? thread.verified_patient_id,
      history,
      { analysis: classification, replyLanguage }
    );
    return;
  }

  facts = buildFactsEnvelope(
    intent,
    {
      patient: null,
      emailMatched: false,
      nameMatched: false,
      dobVerified: false,
      verifiedPatientId: null,
    },
    facts
  );

  await sendReplyAndUpdateThread(
    payload,
    thread,
    intent,
    facts,
    status,
    thread.verified_patient_id,
    history,
    { analysis: classification, replyLanguage }
  );
}

export async function gatherFactsOpenAccess(
  intent: EmailIntent,
  patientId: string | null,
  body: string,
  identityHints: {
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    dob: string | null;
  },
  dbError: string | null,
  locationHint: string | null,
  encounterDateHint: string | null
): Promise<ProcessorFacts> {
  if (
    dbError?.includes("permission denied") &&
    (intent === "soap_note" || intent === "appointment")
  ) {
    return { clinicDataUnavailable: true };
  }

  if (intent === "soap_note") {
    if (!patientId) {
      const hasIdentity =
        identityHints.dob &&
        (identityHints.name ||
          (identityHints.firstName && identityHints.lastName));
      if (hasIdentity) {
        return { soapPatientNotFound: true };
      }
      return { needsPatientForSoap: true };
    }
    return gatherSoapNoteFacts(patientId, encounterDateHint);
  }

  if (intent === "appointment") {
    if (!patientId) {
      return { needsPatientInfo: "appointment" };
    }
    return gatherPatientFacts(intent, patientId, locationHint, encounterDateHint);
  }

  const publicIntent =
    isPublicReadonlyIntent(intent) ||
    intent === "unknown" ||
    intent === "greeting"
      ? intent === "location"
        ? "location"
        : "general_info"
      : null;

  if (publicIntent) {
    const facts = await gatherPublicFacts(publicIntent, body, locationHint);
    return { ...facts, publicOnly: true };
  }

  return gatherPublicFacts("general_info", body, locationHint);
}

async function gatherPublicFacts(
  intent: EmailIntent,
  body: string,
  locationHint: string | null
): Promise<ProcessorFacts> {
  const scope = detectPublicReplyScope(body, intent);
  const facts: ProcessorFacts = { replyScope: scope, publicOnly: true };

  if (scope === "none") {
    return facts;
  }

  if (scope === "services" || scope === "both") {
    facts.services = await listServices();
  }

  if (scope === "locations" || scope === "both") {
    const all = await listLocations();
    if (scope === "locations" && locationHint) {
      const nearest = findNearestLocation(all, locationHint);
      facts.locations = nearest ? [nearest] : all;
      facts.nearestLocation = nearest ?? undefined;
    } else {
      facts.locations = all;
    }
  }

  return facts;
}

async function gatherPatientFacts(
  intent: EmailIntent,
  patientId: string,
  locationHint: string | null,
  encounterDateHint: string | null
): Promise<ProcessorFacts> {
  if (intent === "appointment") {
    const appointment = await getUpcomingAppointment(patientId);
    return { appointment: appointment ?? undefined };
  }

  if (intent === "soap_note") {
    return gatherSoapNoteFacts(patientId, encounterDateHint);
  }

  return {};
}

async function sendReplyAndUpdateThread(
  payload: InboundEmailPayload,
  thread: EmailThread,
  intent: EmailIntent,
  facts: ProcessorFacts,
  status: ThreadStatus,
  verifiedPatientId: string | null,
  history: EmailMessage[],
  options?: {
    replyText?: string;
    analysis?: ClassificationResult;
    replyLanguage?: PatientLanguage;
  }
): Promise<void> {
  const lang: PatientLanguage =
    options?.replyLanguage ?? facts.replyLanguage ?? "en";
  let replyText =
    options?.replyText ??
    (await generateReply(intent, payload.text, facts, history, thread, {
      threadIdForUsage: thread.id,
    }));

  if (
    !options?.replyText &&
    options?.analysis?.shouldAskResolutionFeedback &&
    threadFeedbackStage(thread) === "none"
  ) {
    replyText = appendResolutionPrompt(replyText, lang);
    await updateThreadFeedbackStage(thread.id, "awaiting_resolution");
  }

  const replySubject = payload.subject.replace(/^(re:\s*)+/i, "");
  const lastInbound = await getLastInboundMessageId(thread.id, payload);

  let attachments: EmailAttachment[] | undefined;
  const { attach, soapNote } = resolveOutboundSoapAttachment(
    options?.analysis,
    facts
  );
  if (attach && soapNote) {
    const note = soapNote;
    attachments = [
      {
        filename: soapNotePdfFilename(note),
        content: await buildSoapNotePdf(note),
      },
    ];
  }

  const sent = await sendReply({
    to: extractEmail(payload.from),
    subject: replySubject,
    text: replyText,
    inReplyTo: lastInbound,
    references: payload.references ?? lastInbound,
    attachments,
  });

  await logOutboundMessage(thread.id, replyText, sent.id);
  await updateThread(thread.id, {
    status,
    last_intent: intent,
    verified_patient_id: verifiedPatientId,
    message_id_root: thread.message_id_root ?? payload.messageId ?? null,
  });
}

async function getLastInboundMessageId(
  threadId: string,
  payload: InboundEmailPayload
): Promise<string | undefined> {
  if (payload.messageId) return payload.messageId;
  const messages = await getThreadMessages(threadId);
  const inbound = messages.filter((m) => m.direction === "inbound").pop();
  const meta = inbound?.raw_metadata as { messageId?: string } | null;
  return meta?.messageId;
}

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

export async function processThreadById(threadId: string): Promise<void> {
  const thread = await getThread(threadId);
  if (!thread) throw new Error(`Thread not found: ${threadId}`);

  const messages = await getThreadMessages(threadId);
  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
  if (!lastInbound?.resend_email_id) {
    throw new Error("No inbound message to process");
  }

  const payload = await fetchReceivedEmail(lastInbound.resend_email_id);
  await processInboundEmail(payload, thread);
}
