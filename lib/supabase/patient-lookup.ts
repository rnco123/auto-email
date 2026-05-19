import { getSupabaseAdmin } from "./client";
import { schemaMap } from "./schema-map";
import type { PatientRecord } from "@/lib/types";
import {
  dobMatches,
  dobToIsoDateString,
  namesMatch,
  normalizeName,
} from "./clinical-queries";

const p = schemaMap.patients;
const e = schemaMap.encounters;
const n = schemaMap.aiSoapNotes;

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

async function preferPatientIdsWithSoapNotes(
  candidateIds: string[]
): Promise<string[]> {
  if (candidateIds.length <= 1) return candidateIds;

  const supabase = getSupabaseAdmin();
  const { data: encounters, error: encErr } = await supabase
    .from(e.table)
    .select(`${e.id}, ${e.patientId}`)
    .in(e.patientId, candidateIds);

  if (encErr || !encounters?.length) {
    return candidateIds;
  }

  const encIds = encounters
    .map((row) => (row as Record<string, unknown>)[e.id])
    .filter((id): id is string | number => id != null)
    .map(String);

  if (encIds.length === 0) return candidateIds;

  const { data: notes } = await supabase
    .from(n.table)
    .select(`${n.encounterId}`)
    .in(n.encounterId, encIds);

  const encWithNote = new Set(
    (notes ?? []).map((row) => String((row as Record<string, unknown>)[n.encounterId]))
  );

  const patientHasSoap = new Set<string>();
  for (const row of encounters) {
    const r = row as Record<string, unknown>;
    const eid = String(r[e.id]);
    const pid = String(r[e.patientId]);
    if (encWithNote.has(eid)) patientHasSoap.add(pid);
  }

  const withSoap = candidateIds.filter((id) => patientHasSoap.has(id));
  const without = candidateIds.filter((id) => !patientHasSoap.has(id));
  return [...withSoap, ...without];
}

function filterByName(
  patients: PatientRecord[],
  fullName: string | null,
  first: string,
  last: string
): PatientRecord[] {
  if (first && last) {
    const exact = patients.filter((pt) => {
      const rowFirst = normalizeName(pt.fullName.split(" ")[0] ?? "");
      const rowLast = normalizeName(
        pt.fullName.split(" ").slice(-1)[0] ?? ""
      );
      return (
        normalizeName(first) === rowFirst && normalizeName(last) === rowLast
      );
    });
    if (exact.length) return exact;
  }

  if (fullName) {
    const byName = patients.filter((pt) => namesMatch(pt.fullName, fullName));
    if (byName.length) return byName;
  }

  return [];
}

export async function lookupPatientByIdentity(input: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dob?: string | null;
}): Promise<PatientLookupResult> {
  const dobRaw = input.dob?.trim();
  if (!dobRaw) return { status: "not_found" };

  const first = input.firstName?.trim() ?? "";
  const last = input.lastName?.trim() ?? "";
  const fullName =
    input.fullName?.trim() ||
    [first, last].filter(Boolean).join(" ") ||
    null;

  if (!fullName && !first) return { status: "not_found" };

  const iso = dobToIsoDateString(dobRaw);
  const supabase = getSupabaseAdmin();

  let rows: Record<string, unknown>[] = [];

  if (iso) {
    const { data, error } = await supabase
      .from(p.table)
      .select(`${p.id}, ${p.email}, ${p.firstName}, ${p.lastName}, ${p.dob}`)
      .eq(p.dob, iso);

    if (error) {
      console.error("lookupPatientByIdentity (by dob) error:", error.message);
      return { status: "db_error", message: error.message };
    }
    rows = (data ?? []) as Record<string, unknown>[];
  }

  if (rows.length === 0) {
    const { data, error } = await supabase
      .from(p.table)
      .select(`${p.id}, ${p.email}, ${p.firstName}, ${p.lastName}, ${p.dob}`);

    if (error) {
      console.error("lookupPatientByIdentity error:", error.message);
      return { status: "db_error", message: error.message };
    }
    rows = (data ?? []) as Record<string, unknown>[];
  }

  const patients = rows.map((row) => mapPatientRow(row));
  const dobHits = patients.filter((pt) => dobMatches(pt.dateOfBirth, dobRaw));
  if (dobHits.length === 0) return { status: "not_found" };

  const narrowed = filterByName(dobHits, fullName, first, last);

  if (narrowed.length === 1) {
    return { status: "found", patient: narrowed[0] };
  }

  if (narrowed.length > 1) {
    const orderedIds = await preferPatientIdsWithSoapNotes(
      narrowed.map((x) => x.id)
    );
    const byId = new Map(narrowed.map((x) => [x.id, x]));
    const picked = orderedIds.map((id) => byId.get(id)).find(Boolean);
    if (picked) return { status: "found", patient: picked };
  }

  if (narrowed.length === 0 && (fullName || (first && last))) {
    return { status: "not_found" };
  }

  if (dobHits.length === 1) {
    return { status: "found", patient: dobHits[0] };
  }

  const orderedIds = await preferPatientIdsWithSoapNotes(
    dobHits.map((x) => x.id)
  );
  const byId = new Map(dobHits.map((x) => [x.id, x]));
  const pick = orderedIds.map((id) => byId.get(id)).find(Boolean);
  if (!pick) return { status: "not_found" };

  return { status: "found", patient: pick };
}

export async function findPatientByNameAndDob(
  name: string,
  dob: string
): Promise<PatientRecord | null> {
  const result = await lookupPatientByIdentity({ fullName: name.trim(), dob });
  return result.status === "found" ? result.patient : null;
}
