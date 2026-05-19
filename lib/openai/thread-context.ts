import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getActiveRulesPromptBlock } from "@/lib/openai/active-rules";
import type {
  EmailIntent,
  EmailMessage,
  EmailThread,
  PatientLanguage,
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
      replyLanguage: facts.replyLanguage ?? "en",
      aiGuidance: {
        replyStrategy: facts.replyStrategy ?? null,
        effectiveIntent: facts.effectiveIntent ?? intent,
        systemActions: facts.systemActions ?? [],
        isPolicyQuestion: facts.isPolicyQuestion ?? false,
        attachSoapPdf: facts.attachSoapPdf ?? null,
      },
      clinicData: facts,
      timezone: process.env.APP_TIMEZONE ?? "America/New_York",
    },
    null,
    2
  );
}

/** Full conversation as OpenAI chat messages (patient = user, clinic = assistant). */
export async function buildConversationMessages(
  history: EmailMessage[],
  thread: EmailThread,
  intent: EmailIntent,
  facts: ProcessorFacts,
  latestPatientText: string
): Promise<ChatCompletionMessageParam[]> {
  const lang: PatientLanguage = facts.replyLanguage === "es" ? "es" : "en";
  const adminRules = await getActiveRulesPromptBlock();
  const sorted = [...history]
    .filter((m) => m.body_text?.trim())
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildSystemPrompt(lang, adminRules),
    },
    {
      role: "system",
      content: `Context for this thread (use clinicData only for factual claims; follow aiGuidance.replyStrategy):\n${buildThreadContextBlock(thread, intent, facts)}`,
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

function buildSystemPrompt(lang: PatientLanguage, adminRules: string): string {
  const languageRule =
    lang === "es"
      ? `LANGUAGE: Write entirely in clear, natural Spanish. End with "Gracias," on its own line.`
      : `LANGUAGE: Write entirely in natural English. End with "Thank you," on its own line.`;

  const rulesBlock = adminRules ? `\n\n${adminRules}` : "";

  return `You are a warm, intelligent clinic front-desk assistant for MyClinicMD (email/chat).

${languageRule}${rulesBlock}

How to think (every turn):
1. Read the full thread and the patient's latest message — they may write anything (questions, jokes, typos, English, Spanish, mixed).
2. Follow aiGuidance.replyStrategy in context — it was written for this specific turn.
3. Use clinicData for facts only; never invent clinical details, addresses, or appointments.
4. Answer what they asked NOW. Do not repeat a previous reply (e.g. do not resend "PDF ready" if they asked a policy question).
5. Be conversational — not a form letter, not bullet lists unless listing locations/services.

When clinicData.soapNotePdfAttached is true AND aiGuidance says to share PDF: mention download (chat) or attachment (email). Do not paste clinical text.
When clinicData.soapPatientNotFound: say chart not found; suggest checking spelling.
When clinicData.needsPatientForSoap: ask only for missing info (see identityHints — do not re-ask what you have).
When clinicData.isPolicyQuestion or aiGuidance.isPolicyQuestion: explain we only release records for the verified patient (name + DOB), not others — no PDF.
When clinicData.publicOnly: general or policy answer using clinicData; no SOAP PDF unless they explicitly request their own note again.
When listing services/locations: use clinicData arrays only, one item per line.

Never mention AI, bots, or automation. Plain text, short paragraphs.`;
}
