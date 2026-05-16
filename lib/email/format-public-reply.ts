import type {
  EncounterOption,
  LocationRecord,
  ProcessorFacts,
  PublicReplyScope,
  ServiceRecord,
} from "@/lib/types";

function formatVisitDate(iso: string | null): string {
  if (!iso) return "Unknown date";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: process.env.APP_TIMEZONE ?? "America/New_York",
  });
}

function formatEncounterDateList(options: EncounterOption[]): string {
  return options
    .map((o) => `• ${formatVisitDate(o.encounterDate)}`)
    .join("\n");
}

/** Deterministic SOAP replies — never mix in services or locations. */
export function formatSoapReply(facts: ProcessorFacts): string | null {
  if (facts.soapNotePdfAttached && facts.soapNote) {
    const when = facts.soapNote.encounterDate
      ? `from your visit on ${formatVisitDate(facts.soapNote.encounterDate)}`
      : "from your visit";
    return [
      `Please find your SOAP note ${when} attached as a PDF.`,
      "",
      "Thank you,",
    ].join("\n");
  }

  if (facts.clinicDataUnavailable) {
    return [
      "Our system cannot reach patient records right now (database access is not configured).",
      "",
      "Please ask your clinic admin to enable patient read access in Supabase, then try again.",
      "",
      "Thank you,",
    ].join("\n");
  }

  if (facts.soapPatientNotFound) {
    return [
      "We could not find a patient chart matching that name and date of birth.",
      "",
      "Please check the spelling (as on file) and try again, or call the clinic.",
      "",
      "Thank you,",
    ].join("\n");
  }

  if (facts.needsPatientForSoap || facts.needsPatientInfo === "soap") {
    return [
      "To send your SOAP note as a PDF, please reply with:",
      "",
      "• Your full name and date of birth exactly as they appear on file, or",
      "• The date of your visit (if you have had more than one visit).",
      "",
      "Thank you,",
    ].join("\n");
  }

  if (facts.needsPatientInfo === "appointment") {
    return [
      "To look up your appointment, please reply with your full name and date of birth exactly as they appear on file.",
      "",
      "Thank you,",
    ].join("\n");
  }

  if (facts.needsEncounterDate && facts.encounterOptions?.length) {
    const dates = formatEncounterDateList(facts.encounterOptions);
    if (facts.encounterDateNotFound) {
      return [
        "We could not find a SOAP note for that visit date.",
        "",
        "Please reply with one of these visit dates:",
        "",
        dates,
        "",
        "Thank you,",
      ].join("\n");
    }
    return [
      "We have SOAP notes for more than one visit.",
      "",
      "Please reply with the visit date you need:",
      "",
      dates,
      "",
      "Thank you,",
    ].join("\n");
  }

  if (facts.noSoapOnFile) {
    return [
      "We do not have a SOAP note on file for your chart.",
      "",
      "Please call the clinic if you need assistance.",
      "",
      "Thank you,",
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

function formatServiceLine(svc: ServiceRecord): string {
  if (svc.titleEs && svc.titleEs !== svc.titleEn) {
    return `• ${svc.titleEn} / ${svc.titleEs}`;
  }
  return `• ${svc.titleEn}`;
}

export function formatScopedPublicReply(
  scope: PublicReplyScope,
  services: ServiceRecord[] | undefined,
  locations: LocationRecord[] | undefined
): string | null {
  if (scope === "none") {
    return (
      "Thank you for contacting us. You can ask about our services or clinic locations, and we will be happy to help.\n\nThank you,"
    );
  }

  if (scope === "services") {
    if (!services?.length) {
      return "We do not have service information available by email at the moment. Please call the clinic.\n\nThank you,";
    }
    const lines = services.map(formatServiceLine);
    return [
      "Here are the services we offer:",
      "",
      ...lines,
      "",
      "Reply if you would like more detail about a specific service.",
      "",
      "Thank you,",
    ].join("\n");
  }

  if (scope === "locations") {
    if (!locations?.length) {
      return "We do not have location information available by email at the moment. Please call the clinic.\n\nThank you,";
    }
    const lines = locations.map(formatLocationLine);
    return [
      locations.length === 1
        ? "Here is our clinic location:"
        : "Here are our clinic locations:",
      "",
      ...lines,
      "",
      "Reply with your city or area if you need the location nearest to you.",
      "",
      "Thank you,",
    ].join("\n");
  }

  if (scope === "both") {
    const sections: string[] = [];
    if (services?.length) {
      sections.push("Services we offer:", "", ...services.map(formatServiceLine));
    }
    if (locations?.length) {
      if (sections.length) sections.push("", "");
      sections.push("Clinic locations:", "", ...locations.map(formatLocationLine));
    }
    if (!sections.length) {
      return "Please call the clinic for more information.\n\nThank you,";
    }
    sections.push("", "Thank you,");
    return sections.join("\n");
  }

  return null;
}
