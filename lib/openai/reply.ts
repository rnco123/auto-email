import { getOpenAI, REPLY_MODEL } from "./client";
import type { EmailIntent, ProcessorFacts } from "@/lib/types";

const SYSTEM = `You are a helpful, professional clinic email assistant.
Rules:
- Use ONLY facts provided in the JSON facts object. Never invent appointment times, addresses, or clinical details.
- If facts indicate needsDob or needsName, politely ask for missing verification info.
- If unknownSender, explain we could not match their email and suggest calling the clinic.
- If noSoapOnFile, say no summary is available by email and they should call the clinic.
- Keep replies concise (under 200 words), warm, and plain text.
- Do not mention OpenAI, automation, or internal systems.`;

export async function generateReply(
  intent: EmailIntent,
  patientMessage: string,
  facts: ProcessorFacts
): Promise<string> {
  const client = getOpenAI();

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
          timezone: process.env.APP_TIMEZONE ?? "America/New_York",
        }),
      },
    ],
  });

  return (
    response.choices[0]?.message?.content?.trim() ??
    "Thank you for your message. A team member will follow up shortly."
  );
}
