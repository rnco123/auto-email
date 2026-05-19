import { getOpenAI, REPLY_MODEL } from "./client";
import { logOpenAICompletion } from "./usage-log";
import { buildConversationMessages } from "./thread-context";
import type {
  EmailIntent,
  EmailMessage,
  EmailThread,
  ProcessorFacts,
} from "@/lib/types";

/**
 * Always use the reply model — adapts to any patient message using facts + aiGuidance.
 */
export async function generateReply(
  intent: EmailIntent,
  patientMessage: string,
  facts: ProcessorFacts,
  conversationHistory: EmailMessage[],
  thread: EmailThread,
  options?: { threadIdForUsage?: string | null }
): Promise<string> {
  const client = getOpenAI();

  const messages = await buildConversationMessages(
    conversationHistory,
    thread,
    intent,
    facts,
    patientMessage
  );

  const response = await client.chat.completions.create({
    model: REPLY_MODEL,
    temperature: 0.65,
    messages,
  });

  await logOpenAICompletion(
    response,
    "reply",
    REPLY_MODEL,
    options?.threadIdForUsage ?? thread.id
  );

  const text = response.choices[0]?.message?.content?.trim();
  if (text) return text;

  if (facts.replyLanguage === "es") {
    return "¡Hola! ¿En qué podemos ayudarle hoy?\n\nGracias,";
  }
  return "Hi! How can we help you today?\n\nThank you,";
}
