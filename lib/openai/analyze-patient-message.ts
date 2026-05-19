import { z } from "zod";
import { extractIdentityFromText } from "@/lib/email/extract-identity";
import { detectSoapNoteFromText } from "@/lib/email/public-intent";
import { detectPatientLanguage } from "@/lib/i18n/patient-language";
import { getOpenAI, CLASSIFY_MODEL } from "./client";
import { getActiveRulesPromptBlock } from "./active-rules";
import { logOpenAICompletion } from "./usage-log";
import type {
  ClassificationResult,
  EmailIntent,
  EmailMessage,
  EmailThread,
  PatientLanguage,
  PublicReplyScope,
  SystemAction,
} from "@/lib/types";

const INTENT_VALUES = [
  "appointment",
  "location",
  "soap_note",
  "provide_identity",
  "provide_dob",
  "provide_encounter_date",
  "alternate_email",
  "general_info",
  "greeting",
  "unknown",
] as const;

const EFFECTIVE_INTENTS = [
  "appointment",
  "location",
  "soap_note",
  "general_info",
  "greeting",
  "unknown",
] as const;

const SYSTEM_ACTIONS = [
  "lookup_patient",
  "fetch_soap_note",
  "list_locations",
  "list_services",
  "lookup_appointment",
  "none",
] as const;

const looseSchema = z
  .object({
    intent: z.unknown().optional(),
    effectiveIntent: z.unknown().optional(),
    systemActions: z.unknown().optional(),
    extractedName: z.unknown().optional(),
    extractedFirstName: z.unknown().optional(),
    extractedLastName: z.unknown().optional(),
    extractedDob: z.unknown().optional(),
    extractedLocationHint: z.unknown().optional(),
    extractedEncounterDate: z.unknown().optional(),
    confidence: z.unknown().optional(),
    patientLanguage: z.unknown().optional(),
    replyStrategy: z.unknown().optional(),
    publicReplyScope: z.unknown().optional(),
    attachSoapPdf: z.unknown().optional(),
    isPolicyQuestion: z.unknown().optional(),
    issueLikelyResolved: z.unknown().optional(),
    shouldAskResolutionFeedback: z.unknown().optional(),
  })
  .passthrough();

const SYSTEM_BASE = `You orchestrate a clinic email/chat assistant. Patients may write ANYTHING — adapt with judgment; do not rely on keyword rules.

Return JSON with ALL keys:
- intent, effectiveIntent (soap_note | appointment | location | general_info | greeting | unknown)
- systemActions: array of lookup_patient | fetch_soap_note | list_locations | list_services | lookup_appointment | none
- extractedName, extractedFirstName, extractedLastName, extractedDob (YYYY-MM-DD), extractedLocationHint, extractedEncounterDate
- patientLanguage: "en" | "es"
- replyStrategy: 1-3 sentences telling the reply assistant exactly what to do this turn (tone, answer, what to avoid)
- publicReplyScope: services | locations | both | none
- attachSoapPdf: boolean — true ONLY if this turn should deliver the patient's SOAP PDF
- isPolicyQuestion: boolean — true if asking privacy/access (e.g. someone else's records), not requesting their own chart
- issueLikelyResolved: boolean — true if the patient's main request appears fully addressed this turn (SOAP sent, question answered, etc.)
- shouldAskResolutionFeedback: boolean — true ONLY when issueLikelyResolved is true AND it is appropriate to ask "Is your issue resolved?" after this reply (not mid-verification, not when more info is still required)
- confidence: 0-1

Strategy:
1. Read the FULL thread. Extract identity from any prior patient message.
2. Decide what the patient wants NOW (may differ from earlier turns).
3. Choose systemActions for what the database must fetch. Use "none" for pure conversation/policy.
4. Policy/privacy questions → isPolicyQuestion true, attachSoapPdf false, systemActions ["none"], replyStrategy explains verification policy.
5. Own SOAP request with name+DOB → fetch_soap_note when chart can be looked up; attachSoapPdf true only when sending PDF this turn.
6. If they already received a PDF and now ask something else, attachSoapPdf false.
7. English or Spanish — set patientLanguage and write replyStrategy in that language.
8. Set issueLikelyResolved when the clinic has completed the patient's request; set shouldAskResolutionFeedback only for natural conversation endings (not while still asking for DOB or visit date).

Never return {}. Be specific in replyStrategy.`;

function formatHistory(messages: EmailMessage[]): string {
  return messages
    .filter((m) => m.body_text?.trim())
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    .map(
      (m) =>
        `${m.direction === "inbound" ? "Patient" : "Clinic"}: ${m.body_text?.trim()}`
    )
    .join("\n");
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "null") return null;
  return s;
}

function asIntent(value: unknown, allowed: readonly string[]): EmailIntent | null {
  const s = asNullableString(value);
  if (s && (allowed as readonly string[]).includes(s)) {
    return s as EmailIntent;
  }
  return null;
}

function asPatientLanguage(
  value: unknown,
  fallbackTexts: string[]
): PatientLanguage {
  const s = asNullableString(value);
  if (s === "en" || s === "es") return s;
  return detectPatientLanguage(...fallbackTexts);
}

function asConfidence(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function asBoolean(value: unknown): boolean {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return false;
}

function asPublicReplyScope(value: unknown): PublicReplyScope | undefined {
  const s = asNullableString(value);
  if (s === "services" || s === "locations" || s === "both" || s === "none") {
    return s;
  }
  return undefined;
}

function asSystemActions(value: unknown): SystemAction[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  const actions = list
    .map((item) => asNullableString(item))
    .filter((item): item is SystemAction =>
      !!item && (SYSTEM_ACTIONS as readonly string[]).includes(item)
    );
  return actions;
}

function mergeIdentityFromBodies(bodies: string[]): {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
} {
  let name: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  let dob: string | null = null;

  for (const body of bodies) {
    const hints = extractIdentityFromText(body);
    name = name ?? hints.name;
    firstName = firstName ?? hints.firstName;
    lastName = lastName ?? hints.lastName;
    dob = dob ?? hints.dob;
  }

  if (!name && firstName && lastName) {
    name = `${firstName} ${lastName}`;
  }

  return { name, firstName, lastName, dob };
}

function inferSoapContext(
  body: string,
  thread: EmailThread,
  history: EmailMessage[]
): boolean {
  if (detectSoapNoteFromText(body)) return true;
  if (thread.last_intent === "soap_note") return true;
  const patientText = history
    .filter((m) => m.direction === "inbound" && m.body_text)
    .map((m) => m.body_text as string)
    .join("\n");
  return detectSoapNoteFromText(patientText);
}

function buildFallbackAnalysis(
  body: string,
  thread: EmailThread,
  history: EmailMessage[]
): ClassificationResult {
  const patientBodies = [
    ...history
      .filter((m) => m.direction === "inbound" && m.body_text)
      .map((m) => m.body_text as string),
    body,
  ];
  const identity = mergeIdentityFromBodies(patientBodies);
  const soap = inferSoapContext(body, thread, history);

  let effectiveIntent: EmailIntent = "unknown";
  let systemActions: SystemAction[] = ["none"];

  if (soap) {
    effectiveIntent = "soap_note";
    systemActions =
      identity.name && identity.dob
        ? ["lookup_patient", "fetch_soap_note"]
        : ["lookup_patient"];
  }

  return {
    intent: soap ? "soap_note" : "unknown",
    effectiveIntent,
    systemActions,
    extractedName: identity.name,
    extractedFirstName: identity.firstName,
    extractedLastName: identity.lastName,
    extractedDob: identity.dob,
    extractedLocationHint: null,
    extractedEncounterDate: null,
    patientLanguage: detectPatientLanguage(...patientBodies),
    replyStrategy: soap
      ? "Help the patient with their SOAP note request using facts from the system."
      : "Answer the patient's question naturally using the conversation context.",
    publicReplyScope: "none",
    attachSoapPdf: !!(identity.name && identity.dob && soap),
    isPolicyQuestion: false,
    issueLikelyResolved: false,
    shouldAskResolutionFeedback: false,
    confidence: 0.65,
  };
}

function normalizeAnalysis(
  json: Record<string, unknown>,
  body: string,
  thread: EmailThread,
  history: EmailMessage[]
): ClassificationResult {
  const patientBodies = [
    ...history
      .filter((m) => m.direction === "inbound" && m.body_text)
      .map((m) => m.body_text as string),
    body,
  ];
  const merged = mergeIdentityFromBodies(patientBodies);

  let extractedName = asNullableString(json.extractedName) ?? merged.name;
  let extractedFirstName =
    asNullableString(json.extractedFirstName) ?? merged.firstName;
  let extractedLastName =
    asNullableString(json.extractedLastName) ?? merged.lastName;
  let extractedDob = asNullableString(json.extractedDob) ?? merged.dob;

  if (!extractedName && extractedFirstName && extractedLastName) {
    extractedName = `${extractedFirstName} ${extractedLastName}`;
  }

  const soap = inferSoapContext(body, thread, history);

  let intent =
    asIntent(json.intent, INTENT_VALUES) ??
    (soap ? "soap_note" : "unknown");

  let effectiveIntent =
    asIntent(json.effectiveIntent, EFFECTIVE_INTENTS) ??
    (soap ? "soap_note" : thread.last_intent === "soap_note" ? "soap_note" : intent);

  if (
    effectiveIntent === "unknown" &&
    (thread.last_intent === "soap_note" || soap)
  ) {
    effectiveIntent = "soap_note";
  }

  let systemActions = asSystemActions(json.systemActions);
  if (systemActions.length === 0) {
    if (effectiveIntent === "soap_note") {
      systemActions =
        extractedName && extractedDob
          ? ["lookup_patient", "fetch_soap_note"]
          : ["lookup_patient"];
    } else if (effectiveIntent === "location") {
      systemActions = ["list_locations"];
    } else if (effectiveIntent === "general_info") {
      systemActions = ["list_services"];
    } else if (effectiveIntent === "appointment") {
      systemActions = ["lookup_appointment"];
    } else {
      systemActions = ["none"];
    }
  }

  const isPolicyQuestion = asBoolean(json.isPolicyQuestion);
  const issueLikelyResolved = asBoolean(json.issueLikelyResolved);
  let shouldAskResolutionFeedback = asBoolean(json.shouldAskResolutionFeedback);
  if (shouldAskResolutionFeedback && !issueLikelyResolved) {
    shouldAskResolutionFeedback = false;
  }
  if (
    shouldAskResolutionFeedback &&
    (isPolicyQuestion ||
      (effectiveIntent === "soap_note" && !(extractedName && extractedDob)))
  ) {
    shouldAskResolutionFeedback = false;
  }

  return {
    intent,
    effectiveIntent,
    systemActions,
    extractedName,
    extractedFirstName,
    extractedLastName,
    extractedDob,
    extractedLocationHint: asNullableString(json.extractedLocationHint),
    extractedEncounterDate: asNullableString(json.extractedEncounterDate),
    patientLanguage: asPatientLanguage(json.patientLanguage, patientBodies),
    replyStrategy: asNullableString(json.replyStrategy),
    publicReplyScope: asPublicReplyScope(json.publicReplyScope),
    attachSoapPdf: json.attachSoapPdf === undefined ? undefined : asBoolean(json.attachSoapPdf),
    isPolicyQuestion,
    issueLikelyResolved,
    shouldAskResolutionFeedback,
    confidence: asConfidence(json.confidence, 0.85),
  };
}

export async function analyzePatientMessage(
  subject: string,
  body: string,
  thread: EmailThread,
  conversationHistory: EmailMessage[] = [],
  options?: { threadIdForUsage?: string | null }
): Promise<ClassificationResult> {
  const client = getOpenAI();
  const historyText = formatHistory(conversationHistory);
  const adminRules = await getActiveRulesPromptBlock();
  const systemContent = adminRules
    ? `${SYSTEM_BASE}\n\n${adminRules}`
    : SYSTEM_BASE;

  let raw = "{}";
  try {
    const response = await client.chat.completions.create({
      model: CLASSIFY_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemContent },
        {
          role: "user",
          content: [
            `Thread status: ${thread.status}`,
            `Last intent: ${thread.last_intent ?? "none"}`,
            `Verified patient id: ${thread.verified_patient_id ?? "none"}`,
            `Subject: ${subject}`,
            historyText ? `\nConversation so far:\n${historyText}` : "",
            `\nLatest patient message:\n${body}`,
          ].join("\n"),
        },
      ],
    });
    await logOpenAICompletion(
      response,
      "analyze",
      CLASSIFY_MODEL,
      options?.threadIdForUsage ?? thread.id
    );
    raw = response.choices[0]?.message?.content ?? "{}";
  } catch (error) {
    console.error("analyzePatientMessage API error:", error);
    return buildFallbackAnalysis(body, thread, conversationHistory);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    console.warn("analyzePatientMessage: invalid JSON", raw.slice(0, 200));
    return buildFallbackAnalysis(body, thread, conversationHistory);
  }

  const parsed = looseSchema.safeParse(json);
  if (!parsed.success || typeof json !== "object" || json === null) {
    console.warn("analyzePatientMessage: schema warn", parsed.success ? "" : parsed.error.message);
    return buildFallbackAnalysis(body, thread, conversationHistory);
  }

  return normalizeAnalysis(
    json as Record<string, unknown>,
    body,
    thread,
    conversationHistory
  );
}

/** @deprecated Use analyzePatientMessage */
export const classifyPatientEmail = analyzePatientMessage;
