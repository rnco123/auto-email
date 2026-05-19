import {
  clinicMsg,
  msgSoapWhen,
  msgThankYou,
} from "@/lib/i18n/clinic-messages";
import {
  formatVisitDateLocalized,
  type PatientLanguage,
} from "@/lib/i18n/patient-language";
import type {
  EncounterOption,
  LocationRecord,
  ProcessorFacts,
  PublicReplyScope,
  ServiceRecord,
} from "@/lib/types";

function langFromFacts(facts: ProcessorFacts): PatientLanguage {
  return facts.replyLanguage === "es" ? "es" : "en";
}

function formatEncounterDateList(
  options: EncounterOption[],
  lang: PatientLanguage
): string {
  return options
    .map((o) => `• ${formatVisitDateLocalized(o.encounterDate, lang)}`)
    .join("\n");
}

/** Deterministic SOAP replies — never mix in services or locations. */
export function formatSoapReply(facts: ProcessorFacts): string | null {
  const lang = langFromFacts(facts);

  if (facts.soapNotePdfAttached && facts.soapNote) {
    const when = msgSoapWhen(lang, facts.soapNote.encounterDate);
    const body = facts.replyChannel === "chat"
      ? clinicMsg(lang, "soapPdfReadyChat").replace("{when}", when)
      : clinicMsg(lang, "soapPdfReadyEmail").replace("{when}", when);
    return [body, "", msgThankYou(lang)].join("\n");
  }

  if (facts.clinicDataUnavailable) {
    return [
      clinicMsg(lang, "clinicDataUnavailable"),
      "",
      clinicMsg(lang, "clinicDataUnavailableHint"),
      "",
      msgThankYou(lang),
    ].join("\n");
  }

  if (facts.soapPatientNotFound) {
    return [
      clinicMsg(lang, "chartNotFound"),
      "",
      clinicMsg(lang, "chartNotFoundHint"),
      "",
      msgThankYou(lang),
    ].join("\n");
  }

  if (facts.needsPatientForSoap || facts.needsPatientInfo === "soap") {
    if (facts.identityHints?.name?.trim() && facts.identityHints?.dob) {
      return [
        clinicMsg(lang, "chartNotFound"),
        "",
        clinicMsg(lang, "chartNotFoundHint"),
        "",
        msgThankYou(lang),
      ].join("\n");
    }
    return [
      clinicMsg(lang, "needIdentityIntro"),
      "",
      clinicMsg(lang, "needIdentityNameDob"),
      clinicMsg(lang, "needIdentityVisit"),
      "",
      msgThankYou(lang),
    ].join("\n");
  }

  if (facts.needsPatientInfo === "appointment") {
    return [clinicMsg(lang, "needIdentityAppointment"), "", msgThankYou(lang)].join(
      "\n"
    );
  }

  if (facts.needsEncounterDate && facts.encounterOptions?.length) {
    const dates = formatEncounterDateList(facts.encounterOptions, lang);
    if (facts.encounterDateNotFound) {
      return [
        clinicMsg(lang, "encounterNotFound"),
        "",
        clinicMsg(lang, "pickEncounter"),
        "",
        dates,
        "",
        msgThankYou(lang),
      ].join("\n");
    }
    return [
      clinicMsg(lang, "multipleEncounters"),
      "",
      clinicMsg(lang, "whichEncounter"),
      "",
      dates,
      "",
      msgThankYou(lang),
    ].join("\n");
  }

  if (facts.noSoapOnFile) {
    return [
      clinicMsg(lang, "noSoapOnFile"),
      "",
      clinicMsg(lang, "callClinic"),
      "",
      msgThankYou(lang),
    ].join("\n");
  }

  return null;
}

function formatLocationLine(loc: LocationRecord): string {
  const parts = [loc.title];
  if (loc.address) parts.push(loc.address);
  if (loc.locationCode) parts.push(`(${loc.locationCode})`);
  return `• ${parts.join(" — ")}`;
}

function formatServiceLine(
  svc: ServiceRecord,
  lang: PatientLanguage
): string {
  if (lang === "es" && svc.titleEs?.trim()) {
    return `• ${svc.titleEs}`;
  }
  if (svc.titleEs && svc.titleEs !== svc.titleEn) {
    return `• ${svc.titleEn} / ${svc.titleEs}`;
  }
  return `• ${svc.titleEn}`;
}

export function formatScopedPublicReply(
  scope: PublicReplyScope,
  services: ServiceRecord[] | undefined,
  locations: LocationRecord[] | undefined,
  lang: PatientLanguage = "en"
): string | null {
  if (scope === "none") {
    return [clinicMsg(lang, "contactIntro"), "", msgThankYou(lang)].join("\n");
  }

  if (scope === "services") {
    if (!services?.length) {
      return [clinicMsg(lang, "noServices"), "", msgThankYou(lang)].join("\n");
    }
    const lines = services.map((s) => formatServiceLine(s, lang));
    return [
      clinicMsg(lang, "servicesHeader"),
      "",
      ...lines,
      "",
      clinicMsg(lang, "servicesFooter"),
      "",
      msgThankYou(lang),
    ].join("\n");
  }

  if (scope === "locations") {
    if (!locations?.length) {
      return [clinicMsg(lang, "noLocations"), "", msgThankYou(lang)].join("\n");
    }
    const lines = locations.map(formatLocationLine);
    return [
      locations.length === 1
        ? clinicMsg(lang, "locationOne")
        : clinicMsg(lang, "locationMany"),
      "",
      ...lines,
      "",
      clinicMsg(lang, "locationFooter"),
      "",
      msgThankYou(lang),
    ].join("\n");
  }

  if (scope === "both") {
    const sections: string[] = [];
    if (services?.length) {
      sections.push(
        clinicMsg(lang, "servicesSection"),
        "",
        ...services.map((s) => formatServiceLine(s, lang))
      );
    }
    if (locations?.length) {
      if (sections.length) sections.push("", "");
      sections.push(
        clinicMsg(lang, "locationsSection"),
        "",
        ...locations.map(formatLocationLine)
      );
    }
    if (!sections.length) {
      return [clinicMsg(lang, "callForInfo"), "", msgThankYou(lang)].join("\n");
    }
    sections.push("", msgThankYou(lang));
    return sections.join("\n");
  }

  return null;
}
