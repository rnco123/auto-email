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
import { collectIdentityHints } from "./extract-identity";
import { resolveIdentity } from "./identity";
import {
  buildFactsEnvelope,
  isPublicReadonlyIntent,
  requiresVerification,
} from "./phi-policy";
import type {
  EmailIntent,
  EmailThread,
  InboundEmailPayload,
  ProcessorFacts,
  ThreadStatus,
} from "@/lib/types";

export async function processInboundEmail(
  payload: InboundEmailPayload,
  thread: EmailThread
): Promise<void> {
  const classification = await classifyPatientEmail(
    payload.subject,
    payload.text,
    thread.status
  );

  const claimsAlternateEmail = classification.intent === "alternate_email";

  let intent = classification.intent;
  if (
    intent === "provide_dob" ||
    intent === "provide_identity" ||
    intent === "provide_encounter_date" ||
    intent === "alternate_email"
  ) {
    intent = inferPriorIntent(thread.last_intent) ?? "appointment";
  }
  if (intent === "greeting" && thread.last_intent) {
    intent = thread.last_intent;
  }

  let facts: ProcessorFacts = {};
  let status: ThreadStatus = thread.status;

  if (isPublicReadonlyIntent(intent)) {
    facts = await gatherPublicFacts(intent, classification.extractedLocationHint);
    facts.publicOnly = true;
    status = "active";
  } else {
    const identityHints = await collectIdentityHints(
      payload.text,
      thread.id,
      classification.extractedName,
      classification.extractedDob
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
      identity.verifiedPatientId ?? thread.verified_patient_id
    );
    return;
  }

  facts = buildFactsEnvelope(intent, {
    patient: null,
    emailMatched: false,
    nameMatched: false,
    dobVerified: false,
    verifiedPatientId: null,
  }, facts);

  await sendReplyAndUpdateThread(
    payload,
    thread,
    intent,
    facts,
    status,
    thread.verified_patient_id
  );
}

async function gatherPublicFacts(
  intent: EmailIntent,
  locationHint: string | null
): Promise<ProcessorFacts> {
  const locations = await listLocations();
  const nearest = locationHint
    ? findNearestLocation(locations, locationHint) ?? undefined
    : locations[0] ?? undefined;

  if (intent === "location") {
    return { locations, nearestLocation: nearest, publicOnly: true };
  }

  const services = await listServices();
  return { locations, nearestLocation: nearest, services, publicOnly: true };
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
  verifiedPatientId: string | null
): Promise<void> {
  const history = await getThreadMessages(thread.id);
  const replyText = await generateReply(intent, payload.text, facts, history);

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
