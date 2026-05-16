import { collectIdentityHints } from "@/lib/email/extract-identity";
import {
  findPatientByEmail,
  findPatientById,
} from "@/lib/supabase/clinical-queries";
import { lookupPatientByIdentity } from "@/lib/supabase/patient-lookup";
import type { ClassificationResult, EmailThread, PatientRecord } from "@/lib/types";

export type ResolvePatientResult =
  | { patient: PatientRecord; dbError: null }
  | { patient: null; dbError: string | null };

/** Best-effort patient lookup — never blocks on missing verification. */
export async function resolvePatientOptional(
  senderEmail: string,
  thread: EmailThread,
  body: string,
  classification: ClassificationResult
): Promise<ResolvePatientResult> {
  if (thread.verified_patient_id) {
    const byThread = await findPatientById(thread.verified_patient_id);
    if (byThread) return { patient: byThread, dbError: null };
  }

  const byEmail = await findPatientByEmail(senderEmail);
  if (byEmail) return { patient: byEmail, dbError: null };

  const hints = await collectIdentityHints(
    body,
    thread.id,
    classification.extractedName,
    classification.extractedDob,
    classification.extractedFirstName,
    classification.extractedLastName
  );

  if (!hints.dob) {
    return { patient: null, dbError: null };
  }

  const lookup = await lookupPatientByIdentity({
    fullName: hints.name,
    firstName: hints.firstName,
    lastName: hints.lastName,
    dob: hints.dob,
  });

  if (lookup.status === "found") {
    return { patient: lookup.patient, dbError: null };
  }
  if (lookup.status === "db_error") {
    return { patient: null, dbError: lookup.message };
  }

  return { patient: null, dbError: null };
}
