import type { EmailIntent } from "@/lib/types";

const SERVICE_PATTERNS =
  /\b(services?|what\s+services|what do you (offer|provide|treat)|treatments?|specialt(y|ies)|conditions? (you )?treat|medical services)\b/i;

const LOCATION_PATTERNS =
  /\b(address|location|where are you|directions|office hours|opening hours|hours of operation|which clinic|nearest clinic|find (a |the )?clinic)\b/i;

const SOAP_NOTE_PATTERNS =
  /\b(soap\s*notes?|visit\s+notes?|clinical\s+notes?|medical\s+summar(y|ies))\b/i;

const PRIVATE_PATTERNS =
  /\b(medical record|my appointment|my (visit|encounter)|date of birth|dob)\b/i;

export function detectSoapNoteFromText(body: string): boolean {
  return SOAP_NOTE_PATTERNS.test(body);
}

/** Detect public clinic questions from message text (no verification). */
export function detectPublicIntentFromText(body: string): EmailIntent | null {
  if (detectSoapNoteFromText(body)) return null;
  if (PRIVATE_PATTERNS.test(body)) return null;

  if (SERVICE_PATTERNS.test(body)) return "general_info";
  if (LOCATION_PATTERNS.test(body)) return "location";

  return null;
}

export function resolveIntent(
  classified: EmailIntent,
  body: string,
  lastIntent: EmailIntent | null,
  verificationDisabled = false
): EmailIntent {
  if (detectSoapNoteFromText(body)) return "soap_note";
  if (lastIntent === "soap_note" && classified === "provide_encounter_date") {
    return "soap_note";
  }

  const fromText = detectPublicIntentFromText(body);
  if (fromText) return fromText;

  if (verificationDisabled) {
    if (
      classified === "unknown" ||
      classified === "greeting" ||
      classified === "provide_dob" ||
      classified === "provide_identity" ||
      classified === "alternate_email"
    ) {
      return "general_info";
    }
  }

  if (classified === "greeting" && lastIntent && !fromText) {
    return lastIntent;
  }

  return classified;
}
