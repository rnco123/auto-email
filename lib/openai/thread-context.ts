import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type {
  EmailIntent,
  EmailMessage,
  EmailThread,
  ProcessorFacts,
} from "@/lib/types";

export function buildThreadContextBlock(
  thread: EmailThread,
  intent: EmailIntent,
  facts: ProcessorFacts
): string {
  return JSON.stringify(
    {
      thread: {
        status: thread.status,
        lastIntent: thread.last_intent,
        verifiedPatientId: thread.verified_patient_id,
        subject: thread.subject,
      },
      currentIntent: intent,
      clinicData: facts,
      timezone: process.env.APP_TIMEZONE ?? "America/New_York",
    },
    null,
    2
  );
}

/** Full conversation as OpenAI chat messages (patient = user, clinic = assistant). */
export function buildConversationMessages(
  history: EmailMessage[],
  thread: EmailThread,
  intent: EmailIntent,
  facts: ProcessorFacts,
  latestPatientText: string
): ChatCompletionMessageParam[] {
  const sorted = [...history]
    .filter((m) => m.body_text?.trim())
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildSystemPrompt(),
    },
    {
      role: "system",
      content: `Context for this thread (use clinicData only for factual claims):\n${buildThreadContextBlock(thread, intent, facts)}`,
    },
  ];

  let includedLatest = false;

  for (const msg of sorted) {
    const text = msg.body_text!.trim();
    const role = msg.direction === "inbound" ? "user" : "assistant";
    messages.push({ role, content: text });

    if (
      msg.direction === "inbound" &&
      text.toLowerCase() === latestPatientText.trim().toLowerCase()
    ) {
      includedLatest = true;
    }
  }

  if (!includedLatest && latestPatientText.trim()) {
    messages.push({ role: "user", content: latestPatientText.trim() });
  }

  return messages;
}

function buildSystemPrompt(): string {
  return `You are a warm, human clinic front-desk assistant replying by email for MyClinicMD.

Personality:
- Sound like a real person, not a bot. Natural, friendly, concise.
- If they only say hello/hi, reply briefly (e.g. "Hi! How can we help you today?") and offer help.
- Remember the full email thread — refer back to what was already discussed.
- Answer only what they asked. Do not dump extra topics unless they asked.

Rules:
- Use ONLY facts from clinicData in context. Never invent appointments, addresses, services, or clinical details.
- If clinicData.clinicDataUnavailable is true, explain records are temporarily unreachable (admin must fix database access).
- If clinicData.soapNotePdfAttached is true, say the SOAP note is attached as a PDF (do not paste clinical text). Do not say you will send it later.
- If clinicData.noSoapOnFile is true, say we do not have a SOAP note on file for their chart and suggest calling the clinic. Do not promise to prepare or send one later.
- If clinicData.needsEncounterDate, ask which visit date from encounterOptions.
- If clinicData.needsPatientForSoap or needsPatientInfo, ask naturally for name/DOB or visit date.
- If clinicData.soapPatientNotFound, say you could not find their chart with that info — suggest checking spelling.
- For services or locations, use bullet lists (one per line) when listing multiple items.
- Do not mention AI, automation, or internal systems.
- Plain text only. Short paragraphs. End with "Thank you," on its own line.`;
}
