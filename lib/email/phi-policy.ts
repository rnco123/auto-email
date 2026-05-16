import type { IdentityState } from "@/lib/email/identity";
import type { EmailIntent, ProcessorFacts } from "@/lib/types";

export function requiresVerification(intent: EmailIntent): boolean {
  return intent === "appointment" || intent === "soap_note";
}

/** Public clinic info — no patient verification required. */
export function isPublicReadonlyIntent(intent: EmailIntent): boolean {
  return intent === "location" || intent === "general_info";
}

export function canDiscloseSoap(intent: EmailIntent, identity: IdentityState): boolean {
  return intent === "soap_note" && identity.dobVerified && identity.nameMatched;
}

function isKnownPatient(identity: IdentityState): boolean {
  return !!identity.patient && !!identity.verifiedPatientId;
}

export function buildFactsEnvelope(
  intent: EmailIntent,
  identity: IdentityState,
  facts: ProcessorFacts
): ProcessorFacts {
  if (facts.publicOnly) {
    return facts;
  }

  if (identity.needsAlternateVerification) {
    return {
      needsDob: !identity.dobVerified,
      needsName: !identity.nameMatched,
      alternateEmail: true,
    };
  }

  if (!isKnownPatient(identity) && !identity.emailMatched) {
    return { unknownSender: true };
  }

  if (requiresVerification(intent) && !identity.verifiedPatientId) {
    return {
      needsDob: !identity.dobVerified,
      needsName: !identity.nameMatched,
      patientName: identity.patient?.fullName,
      alternateEmail: identity.verifiedViaAlternateEmail,
    };
  }

  return facts;
}
