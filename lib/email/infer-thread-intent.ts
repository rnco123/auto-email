import type { EmailIntent, EmailMessage } from "@/lib/types";

/** When classifier says provide_* but thread.last_intent is missing, infer from recent clinic replies. */
export function inferIntentFromRecentClinicReplies(
  history: EmailMessage[]
): EmailIntent | null {
  const recent = [...history]
    .filter((m) => m.direction === "outbound" && m.body_text?.trim())
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    .slice(-4);

  const blob = recent.map((m) => m.body_text!.toLowerCase()).join("\n");
  if (!blob) return null;

  if (
    /\bsoap\b|visit note|clinical note|medical summary/i.test(blob) &&
    /date of birth|\bdob\b|full name|first name|last name|your name|name and/i.test(
      blob
    )
  ) {
    return "soap_note";
  }
  if (/which visit|encounter date|visit date|pick.*visit/i.test(blob)) {
    return "soap_note";
  }
  if (
    /\b(next|upcoming)\s+appointment\b|your appointment is\b|appointment\s+time|when\s+is\s+my\s+appointment|schedule\s+(an?\s+)?appointment|reschedule/i.test(
      blob
    ) &&
    !/\bsoap\b|visit note|clinical note/i.test(blob)
  ) {
    return "appointment";
  }
  return null;
}

export function inferPriorIntent(last: EmailIntent | null): EmailIntent | null {
  if (!last) return null;
  if (
    last === "provide_dob" ||
    last === "provide_identity" ||
    last === "provide_encounter_date"
  ) {
    return "appointment";
  }
  return last;
}
