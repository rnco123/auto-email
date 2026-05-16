import { getOpenAI, REPLY_MODEL } from "./client";
import type { EmailIntent, EmailMessage, ProcessorFacts } from "@/lib/types";

const SYSTEM = `You are a helpful, professional clinic email assistant.
Rules:
- Reply directly to what the patient asked in their latest message. Do not send generic acknowledgments like "your query has been received" or "we will answer soon".
- Use ONLY facts provided in the JSON facts object. Never invent appointment times, addresses, or clinical details.
- If facts indicate needsDob or needsName, politely ask for missing verification info.
- If unknownSender, explain we could not match their email and suggest calling the clinic.
- If noSoapOnFile, say no summary is available by email and they should call the clinic.
- Use conversationHistory for context when the patient is continuing a thread.
- Keep replies concise (under 200 words), warm, and plain text.
- Always end with a brief professional closing from the clinic (e.g. "Thank you," on its own line). Your reply is always the last message in the exchange until the patient writes again.
- Do not mention OpenAI, automation, or internal systems.`;

export async function generateReply(
  intent: EmailIntent,
  patientMessage: string,
  facts: ProcessorFacts,
  conversationHistory: EmailMessage[] = []
): Promise<string> {
  const client = getOpenAI();

  const history = conversationHistory
    .filter((m) => m.body_text)
    .map((m) => ({
      from: m.direction === "inbound" ? "patient" : "clinic",
      text: m.body_text,
      at: m.created_at,
    }));

  const response = await client.chat.completions.create({
    model: REPLY_MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          intent,
          patientMessage,
          facts,
          conversationHistory: history,
          timezone: process.env.APP_TIMEZONE ?? "America/New_York",
        }),
      },
    ],
  });

  return (
    response.choices[0]?.message?.content?.trim() ??
    "Thank you for contacting us. Please call the clinic if you need immediate assistance.\n\nThank you,"
  );
}
