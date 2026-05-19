import {
  dobMatches,
  findPatientByEmail,
  findPatientById,
  namesMatch,
} from "@/lib/supabase/clinical-queries";
import { findPatientByNameAndDob } from "@/lib/supabase/patient-lookup";
import type { EmailThread, PatientRecord } from "@/lib/types";

export interface IdentityState {
  patient: PatientRecord | null;
  emailMatched: boolean;
  nameMatched: boolean;
  dobVerified: boolean;
  verifiedPatientId: string | null;
  /** Patient verified on file by name + DOB from a different email. */
  verifiedViaAlternateEmail?: boolean;
  /** Sender not on file; need name + DOB to link to chart. */
  needsAlternateVerification?: boolean;
  /** Name + DOB provided but no matching patient record. */
  verificationFailed?: boolean;
}

export async function resolveIdentity(
  senderEmail: string,
  extractedName: string | null,
  extractedDob: string | null,
  thread: EmailThread,
  claimsAlternateEmail = false
): Promise<IdentityState> {
  const normalizedSender = senderEmail.toLowerCase().trim();

  if (thread.verified_patient_id) {
    const patient = await findPatientById(thread.verified_patient_id);
    if (patient) {
      const emailMatched = patient.email.toLowerCase() === normalizedSender;
      return {
        patient,
        emailMatched,
        nameMatched: true,
        dobVerified: true,
        verifiedPatientId: patient.id,
        verifiedViaAlternateEmail: !emailMatched,
      };
    }
  }

  const patientByEmail = await findPatientByEmail(normalizedSender);
  if (patientByEmail) {
    const nameMatched = extractedName
      ? namesMatch(patientByEmail.fullName, extractedName)
      : false;
    const dobVerified =
      !!extractedDob && dobMatches(patientByEmail.dateOfBirth, extractedDob);

    return {
      patient: patientByEmail,
      emailMatched: true,
      nameMatched,
      dobVerified,
      verifiedPatientId:
        dobVerified && nameMatched ? patientByEmail.id : thread.verified_patient_id,
    };
  }

  if (extractedName && extractedDob) {
    const patient = await findPatientByNameAndDob(extractedName, extractedDob);
    if (patient) {
      return {
        patient,
        emailMatched: false,
        nameMatched: true,
        dobVerified: true,
        verifiedPatientId: patient.id,
        verifiedViaAlternateEmail: true,
      };
    }

    return {
      patient: null,
      emailMatched: false,
      nameMatched: true,
      dobVerified: true,
      verifiedPatientId: null,
      verificationFailed: true,
    };
  }

  if (claimsAlternateEmail || extractedName || extractedDob) {
    return {
      patient: null,
      emailMatched: false,
      nameMatched: !!extractedName,
      dobVerified: !!extractedDob,
      verifiedPatientId: null,
      needsAlternateVerification: true,
    };
  }

  return {
    patient: null,
    emailMatched: false,
    nameMatched: false,
    dobVerified: false,
    verifiedPatientId: null,
  };
}
