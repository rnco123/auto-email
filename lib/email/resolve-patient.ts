import { collectIdentityHints } from "@/lib/email/extract-identity";
import {
  findPatientByEmail,
  findPatientById,
  findPatientByNameAndDob,
} from "@/lib/supabase/clinical-queries";
import type { ClassificationResult, EmailThread, PatientRecord } from "@/lib/types";

/** Best-effort patient lookup — never blocks on missing verification. */
export async function resolvePatientOptional(
  senderEmail: string,
  thread: EmailThread,
  body: string,
  classification: ClassificationResult
): Promise<PatientRecord | null> {
  if (thread.verified_patient_id) {
    const byThread = await findPatientById(thread.verified_patient_id);
    if (byThread) return byThread;
  }

  const byEmail = await findPatientByEmail(senderEmail);
  if (byEmail) return byEmail;

  const hints = await collectIdentityHints(
    body,
    thread.id,
    classification.extractedName,
    classification.extractedDob
  );

  if (hints.name && hints.dob) {
    return findPatientByNameAndDob(hints.name, hints.dob);
  }

  return null;
}
