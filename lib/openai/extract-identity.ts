import { z } from "zod";
import { parseDobParts } from "@/lib/supabase/clinical-queries";
import type { EmailMessage } from "@/lib/types";
import { getOpenAI, CLASSIFY_MODEL } from "./client";
import type { IdentityHints } from "@/lib/email/extract-identity";

const identitySchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
});

const SYSTEM = `You extract a patient's identity from clinic email threads for chart lookup.

The patient may give their name and date of birth in ANY format, for example:
- "Name: Jane Doe" / "DOB: 2001-04-25"
- "first_name: Jane, last_name: Doe, date_of_birth: 2001-04-25"
- "My name is Jane Doe and I was born April 25, 2001"
- "Jane Doe, 04/25/2001"
- A reply that only adds the missing field after the clinic asked

Rules:
- Read the FULL conversation. Combine name from one message and DOB from another if needed.
- Extract only the patient who is requesting their own records (not the clinic, not staff).
- fullName: complete name as one string when possible.
- firstName / lastName: split when you can infer them reliably.
- dateOfBirth: MUST be YYYY-MM-DD when you can determine it; otherwise null.
- Do not guess or invent. If unsure, return null for that field.
- Ignore the clinic's example placeholders unless the patient clearly confirmed them.

Return JSON only.`;

function formatConversation(messages: EmailMessage[], latestBody: string): string {
  const sorted = [...messages]
    .filter((m) => m.body_text?.trim())
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const lines = sorted.map(
    (m) =>
      `${m.direction === "inbound" ? "Patient" : "Clinic"}: ${m.body_text!.trim()}`
  );

  const latestTrimmed = latestBody.trim();
  const lastInbound = sorted.filter((m) => m.direction === "inbound").pop();
  const lastText = lastInbound?.body_text?.trim() ?? "";
  if (latestTrimmed && latestTrimmed.toLowerCase() !== lastText.toLowerCase()) {
    lines.push(`Patient: ${latestTrimmed}`);
  }

  return lines.join("\n\n");
}

function normalizeDob(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const parts = parseDobParts(raw.trim());
  if (!parts) return raw.trim();
  const mm = String(parts.month).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  return `${parts.year}-${mm}-${dd}`;
}

function toHints(data: z.infer<typeof identitySchema>): IdentityHints {
  const firstName = data.firstName?.trim() || null;
  const lastName = data.lastName?.trim() || null;
  const fullName = data.fullName?.trim() || null;
  const dob = normalizeDob(data.dateOfBirth);

  const name =
    fullName ||
    (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName);

  return { name, firstName, lastName, dob };
}

/** AI extraction of patient name/DOB from the full email thread. */
export async function extractPatientIdentityFromConversation(
  messages: EmailMessage[],
  latestBody: string
): Promise<IdentityHints> {
  const conversation = formatConversation(messages, latestBody);
  if (!conversation.trim()) {
    return { name: null, firstName: null, lastName: null, dob: null };
  }

  const client = getOpenAI();

  try {
    const response = await client.chat.completions.create({
      model: CLASSIFY_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Extract patient identity from this email thread:\n\n${conversation}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = identitySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return { name: null, firstName: null, lastName: null, dob: null };
    }

    return toHints(parsed.data);
  } catch (err) {
    console.error("extractPatientIdentityFromConversation error:", err);
    return { name: null, firstName: null, lastName: null, dob: null };
  }
}
