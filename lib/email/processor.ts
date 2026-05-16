import { classifyPatientEmail } from "@/lib/openai/classify";
import { generateReply } from "@/lib/openai/reply";
import {
  findNearestLocation,
  getLatestSoapNote,
  getUpcomingAppointment,
  listPublicLocations,
} from "@/lib/supabase/clinical-queries";
import {
  getThread,
  getThreadMessages,
  logOutboundMessage,
  updateThread,
} from "@/lib/supabase/email-store";
import { fetchReceivedEmail, sendReply } from "@/lib/resend/client";
import { resolveIdentity } from "./identity";
import { buildFactsEnvelope, requiresVerification } from "./phi-policy";
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

  let intent = classification.intent;
  if (intent === "provide_dob" || intent === "provide_identity") {
    intent = inferPriorIntent(thread.last_intent) ?? "appointment";
  }
  if (intent === "greeting" && thread.last_intent) {
    intent = thread.last_intent;
  }

  const identity = await resolveIdentity(
    extractEmail(payload.from),
    classification.extractedName,
    classification.extractedDob,
    thread
  );

  let facts: ProcessorFacts = {};
  let status: ThreadStatus = thread.status;

  if (!identity.emailMatched) {
    status = "unknown_sender";
    facts = { unknownSender: true };
  } else if (requiresVerification(intent) && !identity.dobVerified) {
    status = "needs_dob";
    facts = {
      needsDob: true,
      needsName: !identity.nameMatched,
      patientName: identity.patient?.fullName,
    };
  } else if (
    identity.dobVerified &&
    identity.nameMatched &&
    identity.patient
  ) {
    status = "verified";
    const patientId = identity.patient.id;
    facts = await gatherFacts(
      intent,
      patientId,
      classification.extractedLocationHint
    );
    identity.verifiedPatientId = patientId;
  } else if (intent === "location") {
    facts = await gatherFacts("location", null, classification.extractedLocationHint);
    facts.publicOnly = true;
  }

  facts = buildFactsEnvelope(intent, identity, facts);

  const replyText = await generateReply(intent, payload.text, facts);

  const replySubject = payload.subject.replace(/^(re:\s*)+/i, "");
  const lastInbound = await getLastInboundMessageId(thread.id, payload);

  const sent = await sendReply({
    to: extractEmail(payload.from),
    subject: replySubject,
    text: replyText,
    inReplyTo: lastInbound,
    references: payload.references ?? lastInbound,
  });

  await logOutboundMessage(thread.id, replyText, sent.id);
  await updateThread(thread.id, {
    status,
    last_intent: intent,
    verified_patient_id: identity.verifiedPatientId ?? thread.verified_patient_id,
    message_id_root: thread.message_id_root ?? payload.messageId ?? null,
  });
}

async function gatherFacts(
  intent: EmailIntent,
  patientId: string | null,
  locationHint: string | null
): Promise<ProcessorFacts> {
  if (intent === "location") {
    const locations = await listPublicLocations();
    const nearest = locationHint
      ? findNearestLocation(locations, locationHint) ?? undefined
      : locations[0] ?? undefined;
    return { locations, nearestLocation: nearest, publicOnly: true };
  }

  if (!patientId) return {};

  if (intent === "appointment") {
    const appointment = await getUpcomingAppointment(patientId);
    return { appointment: appointment ?? undefined };
  }

  if (intent === "soap_note") {
    const soapNote = await getLatestSoapNote(patientId);
    if (!soapNote) return { noSoapOnFile: true };
    return { soapNote };
  }

  return {};
}

function inferPriorIntent(last: EmailIntent | null): EmailIntent | null {
  if (!last) return null;
  if (last === "provide_dob" || last === "provide_identity") return "appointment";
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
