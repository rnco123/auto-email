import type { LocationRecord, PublicReplyScope, ServiceRecord } from "@/lib/types";

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
