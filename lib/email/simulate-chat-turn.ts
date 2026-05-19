import { processPatientTurn } from "@/lib/email/process-patient-turn";
import type {
  ClassificationResult,
  EmailIntent,
  EmailThread,
  ProcessorFacts,
} from "@/lib/types";

export type ChatTranscriptTurn = { role: "patient" | "clinic"; text: string };

function transcriptToMessages(
  transcript: ChatTranscriptTurn[],
  threadId: string
) {
  const t0 = Date.now();
  return transcript.map((turn, i) => ({
    id: `sim-${threadId}-${i}`,
    thread_id: threadId,
    direction: turn.role === "patient" ? ("inbound" as const) : ("outbound" as const),
    resend_email_id: null,
    body_text: turn.text,
    raw_metadata: null,
    created_at: new Date(t0 + i * 1000).toISOString(),
  }));
}

/**
 * Run one assistant turn: AI analyzes the message first, then the system
 * runs lookups, then AI (or templates) composes the reply.
 */
export async function simulateOpenAccessChatTurn(input: {
  thread: EmailThread;
  transcriptBeforeThisMessage: ChatTranscriptTurn[];
  patientMessage: string;
  fromEmail?: string;
  subject?: string;
}): Promise<{
  intent: EmailIntent;
  replyText: string;
  facts: ProcessorFacts;
  classification: ClassificationResult;
  attachment?: { filename: string; base64: string };
  patientId: string | null;
  patientName: string | null;
  feedbackPrompt?: {
    stage: "resolution" | "rating";
    language: "en" | "es";
  } | null;
}> {
  const from = input.fromEmail ?? input.thread.patient_email;
  const history = transcriptToMessages(
    input.transcriptBeforeThisMessage,
    input.thread.id
  );

  const result = await processPatientTurn({
    thread: input.thread,
    patientMessage: input.patientMessage,
    subject: input.subject ?? input.thread.subject ?? "Chat",
    fromEmail: from,
    history,
    replyChannel: "chat",
  });

  return {
    intent: result.intent,
    replyText: result.replyText,
    facts: result.facts,
    classification: result.analysis,
    attachment: result.attachment,
    patientId: result.patientId,
    patientName: result.patientName,
    feedbackPrompt: result.feedbackPrompt ?? null,
  };
}
