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
const s = schemaMap.soapNotes;

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

  for (const row of data ?? []) {
    const patient = mapPatientRow(row as Record<string, unknown>);
    if (dobMatches(patient.dateOfBirth, dob) && namesMatch(patient.fullName, name)) {
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

export function parseDob(input: string): Date | null {
  const trimmed = input.trim();
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(trimmed);
  if (iso) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  const us = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(trimmed);
  if (us) {
    const [, month, day, year] = us;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function dobMatches(patientDob: string, provided: string): boolean {
  const expected = parseDob(patientDob);
  const actual = parseDob(provided);
  if (!expected || !actual) return false;
  return (
    expected.getUTCFullYear() === actual.getUTCFullYear() &&
    expected.getUTCMonth() === actual.getUTCMonth() &&
    expected.getUTCDate() === actual.getUTCDate()
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

export async function getLatestSoapNote(
  patientId: string
): Promise<SoapNoteRecord | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(s.table)
    .select(`${s.id}, ${s.content}, ${s.visitDate}`)
    .eq(s.patientId, patientId)
    .order(s.visitDate, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getLatestSoapNote error:", error.message);
    return null;
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    id: String(row[s.id]),
    visitDate: row[s.visitDate] ? String(row[s.visitDate]) : null,
    summary: String(row[s.content]),
  };
}
