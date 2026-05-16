import { extractIdentityFromText } from "@/lib/email/extract-identity";
import type { EmailIntent } from "@/lib/types";

const SERVICE_PATTERNS =
  /\b(services?|what\s+services|what do you (offer|provide|treat)|treatments?|specialt(y|ies)|conditions? (you )?treat|medical services)\b/i;

const LOCATION_PATTERNS =
  /\b(address|address(es)?|location|locations|where (are you|is the clinic|can i find)|directions|office hours|opening hours|hours of operation|which clinic|nearest clinic|find (a |the )?clinic|clinic (location|address|near))\b/i;

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

function isSoapThreadFollowUp(
  classified: EmailIntent,
  body: string,
  lastIntent: EmailIntent | null
): boolean {
  if (lastIntent !== "soap_note") return false;
  if (
    classified === "provide_dob" ||
    classified === "provide_identity" ||
    classified === "provide_encounter_date" ||
    classified === "unknown"
  ) {
    return true;
  }
  const hints = extractIdentityFromText(body);
  return !!(hints.name && hints.dob) || !!hints.dob;
}

export function resolveIntent(
  classified: EmailIntent,
  body: string,
  lastIntent: EmailIntent | null,
  verificationDisabled = false
): EmailIntent {
  if (detectSoapNoteFromText(body)) return "soap_note";

  const fromText = detectPublicIntentFromText(body);
  if (fromText) return fromText;

  if (isSoapThreadFollowUp(classified, body, lastIntent)) return "soap_note";

  if (verificationDisabled) {
    if (
      classified === "unknown" ||
      classified === "greeting" ||
      classified === "provide_dob" ||
      classified === "provide_identity" ||
      classified === "alternate_email"
    ) {
      return lastIntent === "soap_note" ? "soap_note" : "general_info";
    }
  }

  if (classified === "greeting" && lastIntent && !fromText) {
    return lastIntent;
  }

  return classified;
}
