import { getOpenAI, REPLY_MODEL } from "./client";
import { buildConversationMessages } from "./thread-context";
import type {
  EmailIntent,
  EmailMessage,
  EmailThread,
  ProcessorFacts,
} from "@/lib/types";

export async function generateReply(
  intent: EmailIntent,
  patientMessage: string,
  facts: ProcessorFacts,
  conversationHistory: EmailMessage[],
  thread: EmailThread
): Promise<string> {
  const client = getOpenAI();

  const messages = buildConversationMessages(
    conversationHistory,
    thread,
    intent,
    facts,
    patientMessage
  );

  const response = await client.chat.completions.create({
    model: REPLY_MODEL,
    temperature: 0.55,
    messages,
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (text) return text;

  return "Hi! How can we help you today?\n\nThank you,";
}
