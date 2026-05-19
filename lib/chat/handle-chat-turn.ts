import { simulateOpenAccessChatTurn } from "@/lib/email/simulate-chat-turn";
import type { ChatTranscriptTurn } from "@/lib/email/simulate-chat-turn";
import { isVerificationDisabled } from "@/lib/email/phi-policy";
import type { EmailThread } from "@/lib/types";

export type ChatTurnRequest = {
  transcript?: ChatTranscriptTurn[];
  patientMessage?: string;
  fromEmail?: string;
  subject?: string | null;
  lastIntent?: EmailThread["last_intent"];
  verifiedPatientId?: string | null;
};

export async function handleChatTurn(body: ChatTurnRequest) {
  if (!isVerificationDisabled()) {
    throw new Error(
      "Chat testing requires open-access mode (DISABLE_PATIENT_VERIFICATION must not be false)."
    );
  }

  const transcript = body.transcript ?? [];
  const patientMessage = body.patientMessage?.trim();
  if (!patientMessage) {
    throw new Error("patientMessage is required");
  }

  const fromEmail = body.fromEmail?.trim() || "patient@example.com";

  const thread: EmailThread = {
    id: "chat-sim",
    patient_email: fromEmail,
    subject: body.subject ?? "Chat",
    status: "active",
    last_intent: body.lastIntent ?? null,
    verified_patient_id: body.verifiedPatientId ?? null,
    message_id_root: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const result = await simulateOpenAccessChatTurn({
    thread,
    transcriptBeforeThisMessage: transcript,
    patientMessage,
    fromEmail,
    subject: body.subject ?? undefined,
  });

  return {
    intent: result.intent,
    effectiveIntent: result.classification.effectiveIntent ?? null,
    systemActions: result.classification.systemActions ?? null,
    replyText: result.replyText,
    factsKeys: Object.keys(result.facts),
    confidence: result.classification.confidence,
    attachment: result.attachment ?? null,
    patientId: result.patientId ?? null,
    patientName: result.patientName ?? null,
    identityHints: result.facts.identityHints ?? null,
    replyLanguage: result.facts.replyLanguage ?? "en",
    replyStrategy: result.classification.replyStrategy ?? null,
    isPolicyQuestion: result.classification.isPolicyQuestion ?? false,
    issueLikelyResolved: result.classification.issueLikelyResolved ?? false,
    shouldAskResolutionFeedback:
      result.classification.shouldAskResolutionFeedback ?? false,
    feedbackPrompt: result.feedbackPrompt ?? null,
  };
}
