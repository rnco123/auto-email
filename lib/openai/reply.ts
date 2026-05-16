import { getOpenAI, REPLY_MODEL } from "./client";
import type { EmailIntent, EmailMessage, ProcessorFacts } from "@/lib/types";

const SYSTEM = `You are a helpful, professional clinic email assistant.
Rules:
- Reply directly to what the patient asked in their latest message. Do not send generic acknowledgments like "your query has been received" or "we will answer soon".
- Use ONLY facts provided in the JSON facts object. Never invent appointment times, addresses, or clinical details.
- If publicOnly is true, answer using locations and/or services from facts. Never ask for name, date of birth, or identity verification.
- If services or locations are in facts, list them clearly when the patient asks about services, treatments, or clinic info.
- Only mention verification (name, DOB, email on file) if facts explicitly include needsDob, needsName, unknownSender, verificationFailed, or alternateEmail with those needs — otherwise do not ask for verification.
- If noSoapOnFile, say no visit summary is available by email and they should call the clinic.
- If needsEncounterDate, list encounterOptions dates and ask which visit date they need the SOAP note for. Do not include SOAP clinical text in the email.
- If encounterDateNotFound, say you could not match that date and list encounterOptions again.
- If soapNotePdfAttached is true, confirm the SOAP note is attached as a PDF. Do not repeat subjective/objective/assessment/plan text in the email body.
- If publicOnly is true, share locations (title, address, locationCode) and/or services (titleEn, titleEs) from facts only. No verification needed. List clearly if multiple.
- For location intent with publicOnly, focus on clinic addresses. For general_info, include services and locations when available.
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
