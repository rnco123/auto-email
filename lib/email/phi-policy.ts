import type { IdentityState } from "@/lib/email/identity";
import type { EmailIntent, ProcessorFacts } from "@/lib/types";

export function requiresVerification(intent: EmailIntent): boolean {
  return intent === "appointment" || intent === "soap_note";
}

export function canDiscloseSoap(intent: EmailIntent, identity: IdentityState): boolean {
  return intent === "soap_note" && identity.dobVerified && identity.nameMatched;
}

export function buildFactsEnvelope(
  intent: EmailIntent,
  identity: IdentityState,
  facts: ProcessorFacts
): ProcessorFacts {
  if (!identity.emailMatched) {
    return { unknownSender: true };
  }

  if (requiresVerification(intent) && !identity.dobVerified) {
    return {
      needsDob: !identity.dobVerified,
      needsName: !identity.nameMatched,
      patientName: identity.patient?.fullName,
    };
  }

  return facts;
}
