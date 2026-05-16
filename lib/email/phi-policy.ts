import type { IdentityState } from "@/lib/email/identity";
import type { EmailIntent, ProcessorFacts } from "@/lib/types";

/** Sample/demo mode: set DISABLE_PATIENT_VERIFICATION=false for production. */
export function isVerificationDisabled(): boolean {
  return process.env.DISABLE_PATIENT_VERIFICATION !== "false";
}

export function requiresVerification(intent: EmailIntent): boolean {
  if (isVerificationDisabled()) return false;
  return intent === "appointment" || intent === "soap_note";
}

/** Public clinic info — no patient verification required. */
export function isPublicReadonlyIntent(intent: EmailIntent): boolean {
  return intent === "location" || intent === "general_info";
}

export function canDiscloseSoap(intent: EmailIntent, identity: IdentityState): boolean {
  if (isVerificationDisabled()) return intent === "soap_note";
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
  if (isVerificationDisabled() || facts.publicOnly) {
    return facts;
  }

  if (identity.verificationFailed) {
    return { verificationFailed: true, alternateEmail: true };
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
