import type { ClassificationResult } from "@/lib/types";

export type PatientLanguage = "en" | "es";

const SPANISH_MARKERS =
  /\b(hola|buenos días|buenas tardes|gracias|por favor|necesito|quisiera|puedo|nombre|nacimiento|fecha de nacimiento|nota clínica|nota soap|visita|cita|ubicación|dirección|servicios|disculpe|ayuda|mi nombre|cumpleaños|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/gi;

const ENGLISH_MARKERS =
  /\b(hello|hi|thanks|thank you|please|need|would like|my name|date of birth|soap note|visit|appointment|location|services|help|january|february|march|april|may|june|july|august|september|october|november|december)\b/gi;

export function detectPatientLanguage(...texts: string[]): PatientLanguage {
  const blob = texts.filter(Boolean).join("\n");
  if (!blob.trim()) return "en";

  const es = (blob.match(SPANISH_MARKERS) ?? []).length;
  const en = (blob.match(ENGLISH_MARKERS) ?? []).length;

  if (es > en) return "es";
  if (en > es) return "en";

  if (/[¿¡]/.test(blob)) return "es";
  return "en";
}

export function resolveReplyLanguage(
  analysis: ClassificationResult | null,
  latestMessage: string,
  priorPatientBodies: string[]
): PatientLanguage {
  if (analysis?.patientLanguage === "es" || analysis?.patientLanguage === "en") {
    return analysis.patientLanguage;
  }
  return detectPatientLanguage(latestMessage, ...priorPatientBodies);
}

export function localeForLanguage(lang: PatientLanguage): string {
  return lang === "es" ? "es-US" : "en-US";
}

export function formatVisitDateLocalized(
  iso: string | null,
  lang: PatientLanguage
): string {
  if (!iso) return lang === "es" ? "Fecha desconocida" : "Unknown date";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(localeForLanguage(lang), {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: process.env.APP_TIMEZONE ?? "America/New_York",
  });
}
