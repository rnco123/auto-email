import { z } from "zod";
import { getOpenAI, CLASSIFY_MODEL } from "./client";
import type { ClassificationResult, EmailIntent } from "@/lib/types";

const classificationSchema = z.object({
  intent: z.enum([
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
  ]),
  extractedName: z.string().nullable(),
  extractedDob: z.string().nullable(),
  extractedLocationHint: z.string().nullable(),
  extractedEncounterDate: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const SYSTEM = `You classify patient emails for a clinic automation system.
Return JSON only.

Intents:
- appointment: asking about appointment time, schedule, when to come
- location: clinic address, directions, which location, nearest clinic
- general_info: services offered, what do you provide/treat, list of treatments, general questions about the clinic (NO verification — use this even if they say hello first)
- soap_note: requesting visit notes, SOAP note, medical summary from visit
- provide_encounter_date: patient gives the visit/encounter date (often replying to a request to pick which visit)
- provide_identity: patient gives their name for verification
- provide_dob: patient gives date of birth
- alternate_email: patient says they are using a different email than on file
- greeting: ONLY a hello with no question (e.g. "Hi" alone)
- unknown: unclear AND not a public clinic question

Important: "Hello, what services do you offer?" → general_info (not greeting or unknown).

Extract:
- extractedName: full name if mentioned
- extractedDob: date of birth if mentioned (any format)
- extractedLocationHint: city, zip, neighborhood, or "near me" context for location queries
- extractedEncounterDate: visit or encounter date if mentioned (for SOAP note requests)`;

export async function classifyPatientEmail(
  subject: string,
  body: string,
  threadStatus: string
): Promise<ClassificationResult> {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: CLASSIFY_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Thread status: ${threadStatus}\nSubject: ${subject}\n\nBody:\n${body}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = classificationSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    return {
      intent: "unknown",
      extractedName: null,
      extractedDob: null,
      extractedLocationHint: null,
      extractedEncounterDate: null,
      confidence: 0,
    };
  }

  const d = parsed.data;
  return {
    intent: d.intent as EmailIntent,
    extractedName: d.extractedName,
    extractedDob: d.extractedDob,
    extractedLocationHint: d.extractedLocationHint,
    extractedEncounterDate: d.extractedEncounterDate,
    confidence: d.confidence,
  };
}
