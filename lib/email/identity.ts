import {
  dobMatches,
  findPatientByEmail,
  namesMatch,
} from "@/lib/supabase/clinical-queries";
import type { EmailThread, PatientRecord } from "@/lib/types";

export interface IdentityState {
  patient: PatientRecord | null;
  emailMatched: boolean;
  nameMatched: boolean;
  dobVerified: boolean;
  verifiedPatientId: string | null;
}

export async function resolveIdentity(
  senderEmail: string,
  extractedName: string | null,
  extractedDob: string | null,
  thread: EmailThread
): Promise<IdentityState> {
  const patient = await findPatientByEmail(senderEmail);
  const emailMatched = !!patient;

  if (!patient) {
    return {
      patient: null,
      emailMatched: false,
      nameMatched: false,
      dobVerified: false,
      verifiedPatientId: null,
    };
  }

  if (thread.verified_patient_id === patient.id) {
    return {
      patient,
      emailMatched: true,
      nameMatched: true,
      dobVerified: true,
      verifiedPatientId: patient.id,
    };
  }

  const nameMatched = extractedName
    ? namesMatch(patient.fullName, extractedName)
    : false;

  const dobVerified =
    !!extractedDob && dobMatches(patient.dateOfBirth, extractedDob);

  return {
    patient,
    emailMatched,
    nameMatched,
    dobVerified,
    verifiedPatientId: dobVerified && nameMatched ? patient.id : null,
  };
}
