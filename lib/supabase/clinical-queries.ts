import { getSupabaseAdmin } from "./client";
import { schemaMap } from "./schema-map";
import type {
  AppointmentRecord,
  LocationRecord,
  PatientRecord,
  ServiceRecord,
  SoapNoteRecord,
} from "@/lib/types";

const p = schemaMap.patients;
const a = schemaMap.appointments;
const l = schemaMap.locations;
const svc = schemaMap.services;
const e = schemaMap.encounters;
const n = schemaMap.aiSoapNotes;

function mapPatientRow(row: Record<string, unknown>): PatientRecord {
  return {
    id: String(row[p.id]),
    email: String(row[p.email]),
    fullName: String(row[p.fullName]),
    dateOfBirth: String(row[p.dob]),
  };
}

export async function findPatientById(
  patientId: string
): Promise<PatientRecord | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(p.table)
    .select(`${p.id}, ${p.email}, ${p.fullName}, ${p.dob}`)
    .eq(p.id, patientId)
    .maybeSingle();

  if (error) {
    console.error("findPatientById error:", error.message);
    return null;
  }
  if (!data) return null;

  return mapPatientRow(data as Record<string, unknown>);
}

export async function findPatientByEmail(
  email: string
): Promise<PatientRecord | null> {
  const supabase = getSupabaseAdmin();
  const normalized = email.toLowerCase().trim();

  const { data, error } = await supabase
    .from(p.table)
    .select(`${p.id}, ${p.email}, ${p.fullName}, ${p.dob}`)
    .ilike(p.email, normalized)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("findPatientByEmail error:", error.message);
    return null;
  }
  if (!data) return null;

  return mapPatientRow(data as Record<string, unknown>);
}

/** Verify identity when patient emails from an address not on file. */
export async function findPatientByNameAndDob(
  name: string,
  dob: string
): Promise<PatientRecord | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(p.table)
    .select(`${p.id}, ${p.email}, ${p.fullName}, ${p.dob}`);

  if (error) {
    console.error("findPatientByNameAndDob error:", error.message);
    return null;
  }

  const patients = (data ?? []).map((row) =>
    mapPatientRow(row as Record<string, unknown>)
  );

  for (const patient of patients) {
    if (dobMatches(patient.dateOfBirth, dob) && namesMatch(patient.fullName, name)) {
      return patient;
    }
  }

  const dobMatchesList = patients.filter((p) => dobMatches(p.dateOfBirth, dob));
  if (dobMatchesList.length === 1) {
    return dobMatchesList[0];
  }

  const nameParts = normalizeName(name).split(" ").filter(Boolean);
  const lastName = nameParts[nameParts.length - 1];

  for (const patient of dobMatchesList) {
    const pn = normalizeName(patient.fullName);
    if (lastName && pn.includes(lastName) && namesMatch(patient.fullName, name)) {
      return patient;
    }
  }

  return null;
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesMatch(patientName: string, providedName: string): boolean {
  const a = normalizeName(patientName);
  const b = normalizeName(providedName);
  if (a === b) return true;

  const aParts = a.split(" ").filter(Boolean);
  const bParts = b.split(" ").filter(Boolean);
  if (aParts.length < 2 || bParts.length < 2) {
    return a.includes(b) || b.includes(a);
  }

  const aFirst = aParts[0];
  const aLast = aParts[aParts.length - 1];
  const bFirst = bParts[0];
  const bLast = bParts[bParts.length - 1];
  return aFirst === bFirst && aLast === bLast;
}

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

/** Parse a date string into calendar parts (timezone-safe for DOB matching). */
export function parseDobParts(input: string): DateParts | null {
  const trimmed = input.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  }

  const us = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(trimmed);
  if (us) {
    const [, month, day, year] = us;
    return { year: Number(year), month: Number(month), day: Number(day) };
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

export function parseDob(input: string): Date | null {
  const parts = parseDobParts(input);
  if (!parts) return null;
  const d = new Date(parts.year, parts.month - 1, parts.day);
  return isNaN(d.getTime()) ? null : d;
}

export function dobMatches(patientDob: string, provided: string): boolean {
  const expected = parseDobParts(patientDob);
  const actual = parseDobParts(provided);
  if (!expected || !actual) return false;
  return (
    expected.year === actual.year &&
    expected.month === actual.month &&
    expected.day === actual.day
  );
}

export async function getUpcomingAppointment(
  patientId: string
): Promise<AppointmentRecord | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from(a.table)
    .select(`${a.id}, ${a.startsAt}, ${a.locationId}`)
    .eq(a.patientId, patientId)
    .gte(a.startsAt, now)
    .order(a.startsAt, { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getUpcomingAppointment error:", error.message);
    return null;
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  let locationName: string | null = null;
  let locationAddress: string | null = null;

  const locationId = row[a.locationId];
  if (locationId) {
    const { data: loc } = await supabase
      .from(l.table)
      .select(`${l.title}, ${l.address}`)
      .eq(l.id, locationId)
      .maybeSingle();
    if (loc) {
      const lr = loc as Record<string, unknown>;
      locationName = String(lr[l.title]);
      locationAddress = lr[l.address] ? String(lr[l.address]) : null;
    }
  }

  return {
    id: String(row[a.id]),
    startsAt: String(row[a.startsAt]),
    locationName,
    locationAddress,
  };
}

export async function listLocations(): Promise<LocationRecord[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(l.table)
    .select(`${l.id}, ${l.title}, ${l.address}, ${l.locationCode}`)
    .order(l.id, { ascending: true });

  if (error) {
    console.error("listLocations error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r[l.id]),
      title: String(r[l.title] ?? "Clinic location"),
      address: r[l.address] ? String(r[l.address]) : null,
      locationCode: r[l.locationCode] ? String(r[l.locationCode]) : null,
    };
  });
}

export async function listServices(): Promise<ServiceRecord[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(svc.table)
    .select(`${svc.id}, ${svc.titleEn}, ${svc.titleEs}`)
    .order(svc.id, { ascending: true });

  if (error) {
    console.error("listServices error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r[svc.id]),
      titleEn: String(r[svc.titleEn]),
      titleEs: r[svc.titleEs] ? String(r[svc.titleEs]) : null,
    };
  });
}

export function findNearestLocation(
  locations: LocationRecord[],
  hint: string
): LocationRecord | null {
  if (locations.length === 0) return null;
  const h = hint.toLowerCase();

  const textMatches = locations.filter((loc) => {
    const parts = [loc.title, loc.address, loc.locationCode]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      parts.includes(h) ||
      h.split(/\s+/).some((w) => w.length > 2 && parts.includes(w))
    );
  });

  if (textMatches.length >= 1) return textMatches[0];
  return locations[0];
}

function mapSoapNoteRow(
  row: Record<string, unknown>,
  encounterDate: string | null
): SoapNoteRecord {
  return {
    id: String(row[n.id]),
    encounterId: row[n.encounterId] != null ? String(row[n.encounterId]) : null,
    encounterDate,
    subjective: row[n.subjective] ? String(row[n.subjective]) : null,
    objective: row[n.objective] ? String(row[n.objective]) : null,
    assessment: row[n.assessment] ? String(row[n.assessment]) : null,
    plan: row[n.plan] ? String(row[n.plan]) : null,
  };
}

export async function listPatientSoapNotes(
  patientId: string
): Promise<SoapNoteRecord[]> {
  const supabase = getSupabaseAdmin();

  const { data: encounters, error: encError } = await supabase
    .from(e.table)
    .select(`${e.id}, ${e.encounterDate}`)
    .eq(e.patientId, patientId)
    .order(e.encounterDate, { ascending: false });

  if (encError) {
    console.error("listPatientSoapNotes encounters error:", encError.message);
    return [];
  }
  if (!encounters?.length) return [];

  const dateByEncounterId = new Map<string, string | null>();
  for (const enc of encounters) {
    const row = enc as Record<string, unknown>;
    dateByEncounterId.set(
      String(row[e.id]),
      row[e.encounterDate] ? String(row[e.encounterDate]) : null
    );
  }

  const encounterIds = encounters.map((enc) => (enc as Record<string, unknown>)[e.id]);

  const { data: notes, error: noteError } = await supabase
    .from(n.table)
    .select(
      `${n.id}, ${n.encounterId}, ${n.subjective}, ${n.objective}, ${n.assessment}, ${n.plan}`
    )
    .in(n.encounterId, encounterIds);

  if (noteError) {
    console.error("listPatientSoapNotes notes error:", noteError.message);
    return [];
  }

  const mapped = (notes ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const encId = r[n.encounterId] != null ? String(r[n.encounterId]) : null;
    return mapSoapNoteRow(r, encId ? dateByEncounterId.get(encId) ?? null : null);
  });

  return mapped.sort((a, b) => {
    const ta = a.encounterDate ? Date.parse(a.encounterDate) : 0;
    const tb = b.encounterDate ? Date.parse(b.encounterDate) : 0;
    return tb - ta;
  });
}

export function matchSoapNoteByEncounterDate(
  notes: SoapNoteRecord[],
  dateHint: string
): SoapNoteRecord | null {
  const target = parseDobParts(dateHint);
  if (!target) return null;

  const matches = notes.filter((note) => {
    if (!note.encounterDate) return false;
    const d = parseDobParts(note.encounterDate);
    if (!d) return false;
    return (
      d.year === target.year &&
      d.month === target.month &&
      d.day === target.day
    );
  });

  return matches[0] ?? null;
}

export function toEncounterOptions(notes: SoapNoteRecord[]) {
  const seen = new Set<string>();
  const options: { encounterId: string; encounterDate: string | null }[] = [];

  for (const note of notes) {
    if (!note.encounterId || seen.has(note.encounterId)) continue;
    seen.add(note.encounterId);
    options.push({
      encounterId: note.encounterId,
      encounterDate: note.encounterDate,
    });
  }

  return options.sort((a, b) => {
    const ta = a.encounterDate ? Date.parse(a.encounterDate) : 0;
    const tb = b.encounterDate ? Date.parse(b.encounterDate) : 0;
    return tb - ta;
  });
}
