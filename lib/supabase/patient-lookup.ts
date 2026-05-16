import { getSupabaseAdmin } from "./client";
import { schemaMap } from "./schema-map";
import type { PatientRecord } from "@/lib/types";
import { dobMatches, namesMatch, normalizeName } from "./clinical-queries";

const p = schemaMap.patients;

export type PatientLookupResult =
  | { status: "found"; patient: PatientRecord }
  | { status: "not_found" }
  | { status: "db_error"; message: string };

function mapPatientRow(row: Record<string, unknown>): PatientRecord {
  const first = row[p.firstName] ? String(row[p.firstName]).trim() : "";
  const last = row[p.lastName] ? String(row[p.lastName]).trim() : "";
  return {
    id: String(row[p.id]),
    email: row[p.email] ? String(row[p.email]) : "",
    fullName: [first, last].filter(Boolean).join(" "),
    dateOfBirth: String(row[p.dob]),
  };
}

export async function lookupPatientByIdentity(input: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dob?: string | null;
}): Promise<PatientLookupResult> {
  const dob = input.dob?.trim();
  if (!dob) return { status: "not_found" };

  const first = input.firstName?.trim() ?? "";
  const last = input.lastName?.trim() ?? "";
  const fullName =
    input.fullName?.trim() ||
    [first, last].filter(Boolean).join(" ") ||
    null;

  if (!fullName && !first) return { status: "not_found" };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(p.table)
    .select(`${p.id}, ${p.email}, ${p.firstName}, ${p.lastName}, ${p.dob}`);

  if (error) {
    console.error("lookupPatientByIdentity error:", error.message);
    return { status: "db_error", message: error.message };
  }

  const patients = (data ?? []).map((row) =>
    mapPatientRow(row as Record<string, unknown>)
  );

  const dobHits = patients.filter((pt) => dobMatches(pt.dateOfBirth, dob));
  if (dobHits.length === 0) return { status: "not_found" };

  if (first && last) {
    const exact = dobHits.find((pt) => {
      const rowFirst = normalizeName(pt.fullName.split(" ")[0] ?? "");
      const rowLast = normalizeName(
        pt.fullName.split(" ").slice(-1)[0] ?? ""
      );
      return (
        normalizeName(first) === rowFirst &&
        normalizeName(last) === rowLast
      );
    });
    if (exact) return { status: "found", patient: exact };
  }

  if (fullName) {
    const byName = dobHits.find((pt) => namesMatch(pt.fullName, fullName));
    if (byName) return { status: "found", patient: byName };
  }

  if (dobHits.length === 1) {
    return { status: "found", patient: dobHits[0] };
  }

  return { status: "not_found" };
}
