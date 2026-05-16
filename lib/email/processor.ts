import { classifyPatientEmail } from "@/lib/openai/classify";
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
import { resolveIntent } from "./public-intent";
import { detectPublicReplyScope } from "./public-scope";
import { collectIdentityHints } from "./extract-identity";
import { resolvePatientOptional } from "./resolve-patient";
import type {
  EmailIntent,
  EmailMessage,
  EmailThread,
  InboundEmailPayload,
  ProcessorFacts,
  ThreadStatus,
} from "@/lib/types";

export async function processInboundEmail(
  payload: InboundEmailPayload,
  thread: EmailThread
): Promise<void> {
  const history = await getThreadMessages(thread.id);
  const classification = await classifyPatientEmail(
    payload.subject,
    payload.text,
    thread,
    history
  );

  let intent = classification.intent;
  if (
    intent === "provide_dob" ||
    intent === "provide_identity" ||
    intent === "provide_encounter_date" ||
    intent === "alternate_email"
  ) {
    intent = inferPriorIntent(thread.last_intent) ?? "appointment";
  }

  const noVerification = isVerificationDisabled();
  intent = resolveIntent(intent, payload.text, thread.last_intent, noVerification);

  if (noVerification) {
    const identityHints = await collectIdentityHints(
      payload.text,
      thread.id,
      classification.extractedName,
      classification.extractedDob,
      classification.extractedFirstName,
      classification.extractedLastName
    );
    const { patient, dbError } = await resolvePatientOptional(
      extractEmail(payload.from),
      thread,
      payload.text,
      classification
    );
    const facts = await gatherFactsOpenAccess(
      intent,
      patient?.id ?? null,
      payload.text,
      identityHints,
      dbError,
      classification.extractedLocationHint,
      classification.extractedEncounterDate
    );
    await sendReplyAndUpdateThread(
      payload,
      thread,
      intent,
      facts,
      "active",
      patient?.id ?? thread.verified_patient_id,
      history
    );
    return;
  }

  // Production path with verification (DISABLE_PATIENT_VERIFICATION=false)
  const { resolveIdentity } = await import("./identity");
  const { requiresVerification } = await import("./phi-policy");

  const claimsAlternateEmail = classification.intent === "alternate_email";
  let facts: ProcessorFacts = {};
  let status: ThreadStatus = thread.status;

  if (isPublicReadonlyIntent(intent)) {
    facts = await gatherPublicFacts(
      intent,
      payload.text,
      classification.extractedLocationHint
    );
    facts.publicOnly = true;
    status = "active";
  } else {
    const identityHints = await collectIdentityHints(
      payload.text,
      thread.id,
      classification.extractedName,
      classification.extractedDob,
      classification.extractedFirstName,
      classification.extractedLastName
    );

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
      facts = await gatherPatientFacts(
        intent,
        identity.patient.id,
        classification.extractedLocationHint,
        classification.extractedEncounterDate
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
      history
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
    history
  );
}

async function gatherFactsOpenAccess(
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
  if (dbError?.includes("permission denied")) {
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
  history: EmailMessage[]
): Promise<void> {
  const replyText = await generateReply(
    intent,
    payload.text,
    facts,
    history,
    thread
  );

  const replySubject = payload.subject.replace(/^(re:\s*)+/i, "");
  const lastInbound = await getLastInboundMessageId(thread.id, payload);

  let attachments: EmailAttachment[] | undefined;
  if (facts.soapNotePdfAttached && facts.soapNote) {
    attachments = [
      {
        filename: soapNotePdfFilename(facts.soapNote),
        content: await buildSoapNotePdf(facts.soapNote),
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

function inferPriorIntent(last: EmailIntent | null): EmailIntent | null {
  if (!last) return null;
  if (
    last === "provide_dob" ||
    last === "provide_identity" ||
    last === "provide_encounter_date"
  ) {
    return "appointment";
  }
  return last;
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
