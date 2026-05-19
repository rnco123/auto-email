import { extractIdentityFromText } from "@/lib/email/extract-identity";
import type { IdentityHints } from "@/lib/email/extract-identity";
import type { ClassificationResult } from "@/lib/types";

function mergeHints(a: IdentityHints, b: IdentityHints): IdentityHints {
  let name = a.name ?? b.name;
  const firstName = a.firstName ?? b.firstName;
  const lastName = a.lastName ?? b.lastName;
  const dob = a.dob ?? b.dob;
  if (!name && firstName && lastName) {
    name = `${firstName} ${lastName}`;
  }
  return { name, firstName, lastName, dob };
}

/** Identity from AI analysis, filled in from thread text when AI omits fields. */
export function identityFromAnalysis(
  analysis: ClassificationResult,
  options?: { patientBodies?: string[] }
): IdentityHints {
  let hints: IdentityHints = {
    name: analysis.extractedName?.trim() || null,
    firstName: analysis.extractedFirstName?.trim() || null,
    lastName: analysis.extractedLastName?.trim() || null,
    dob: analysis.extractedDob?.trim() || null,
  };

  if (!hints.name && hints.firstName && hints.lastName) {
    hints.name = `${hints.firstName} ${hints.lastName}`;
  }

  for (const body of options?.patientBodies ?? []) {
    hints = mergeHints(hints, extractIdentityFromText(body));
  }

  return hints;
}
