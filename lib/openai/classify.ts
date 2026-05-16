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
    "alternate_email",
    "greeting",
    "unknown",
  ]),
  extractedName: z.string().nullable(),
  extractedDob: z.string().nullable(),
  extractedLocationHint: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const SYSTEM = `You classify patient emails for a clinic automation system.
Return JSON only.

Intents:
- appointment: asking about appointment time, schedule, when to come
- location: clinic address, hours, directions, nearest location
- soap_note: requesting visit notes, SOAP note, medical summary from visit
- provide_identity: patient gives their name for verification
- provide_dob: patient gives date of birth
- alternate_email: patient says they are using a different email than on file
- greeting: hello with no specific request yet
- unknown: unclear

Extract:
- extractedName: full name if mentioned
- extractedDob: date of birth if mentioned (any format)
- extractedLocationHint: city, zip, neighborhood, or "near me" context for location queries`;

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
      confidence: 0,
    };
  }

  const d = parsed.data;
  return {
    intent: d.intent as EmailIntent,
    extractedName: d.extractedName,
    extractedDob: d.extractedDob,
    extractedLocationHint: d.extractedLocationHint,
    confidence: d.confidence,
  };
}
