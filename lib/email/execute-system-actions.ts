import { gatherSoapNoteFacts } from "@/lib/email/soap-facts";
import type { IdentityHints } from "@/lib/email/extract-identity";
import {
  findNearestLocation,
  getUpcomingAppointment,
  listLocations,
  listServices,
} from "@/lib/supabase/clinical-queries";
import type {
  ClassificationResult,
  ProcessorFacts,
  PublicReplyScope,
  SystemAction,
} from "@/lib/types";

function hasIdentity(hints: IdentityHints): boolean {
  return !!(
    hints.dob &&
    (hints.name || (hints.firstName && hints.lastName))
  );
}

function scopeFromAnalysis(
  actions: Set<SystemAction>,
  analysis: ClassificationResult
): PublicReplyScope {
  const fromAi = analysis.publicReplyScope;
  if (
    fromAi === "services" ||
    fromAi === "locations" ||
    fromAi === "both" ||
    fromAi === "none"
  ) {
    return fromAi;
  }
  if (actions.has("list_locations") && actions.has("list_services")) {
    return "both";
  }
  if (actions.has("list_locations")) return "locations";
  if (actions.has("list_services")) return "services";
  return "none";
}

async function gatherPublicByScope(
  scope: PublicReplyScope,
  body: string,
  locationHint: string | null
): Promise<ProcessorFacts> {
  const facts: ProcessorFacts = { replyScope: scope, publicOnly: true };

  if (scope === "none") return facts;

  if (scope === "services" || scope === "both") {
    facts.services = await listServices();
  }

  if (scope === "locations" || scope === "both") {
    const all = await listLocations();
    if (scope === "locations" && locationHint) {
      const nearest = findNearestLocation(all, locationHint);
      facts.locations = nearest ? [nearest] : all;
      facts.nearestLocation = nearest ?? undefined;
    } else {
      facts.locations = all;
    }
  }

  return facts;
}

/**
 * Run database lookups based on AI-planned systemActions — not fixed intent rules.
 */
export async function gatherFactsFromAnalysis(
  analysis: ClassificationResult,
  input: {
    patientId: string | null;
    body: string;
    identityHints: IdentityHints;
    dbError: string | null;
    locationHint: string | null;
    encounterDateHint: string | null;
  }
): Promise<ProcessorFacts> {
  const actions = new Set<SystemAction>(analysis.systemActions ?? ["none"]);

  const needsProtectedDb =
    actions.has("fetch_soap_note") || actions.has("lookup_appointment");

  if (input.dbError?.includes("permission denied") && needsProtectedDb) {
    return { clinicDataUnavailable: true };
  }

  const facts: ProcessorFacts = {};

  if (actions.has("fetch_soap_note")) {
    if (!input.patientId) {
      Object.assign(
        facts,
        hasIdentity(input.identityHints)
          ? { soapPatientNotFound: true }
          : { needsPatientForSoap: true }
      );
    } else {
      Object.assign(
        facts,
        await gatherSoapNoteFacts(input.patientId, input.encounterDateHint)
      );
    }
  }

  if (actions.has("lookup_appointment")) {
    if (!input.patientId) {
      facts.needsPatientInfo = "appointment";
    } else {
      const appointment = await getUpcomingAppointment(input.patientId);
      facts.appointment = appointment ?? undefined;
    }
  }

  if (actions.has("list_locations") || actions.has("list_services")) {
    const scope = scopeFromAnalysis(actions, analysis);
    Object.assign(
      facts,
      await gatherPublicByScope(scope, input.body, input.locationHint)
    );
  } else if (
    actions.has("none") ||
    analysis.isPolicyQuestion ||
    analysis.effectiveIntent === "general_info" ||
    analysis.effectiveIntent === "greeting"
  ) {
    facts.publicOnly = true;
    facts.replyScope = scopeFromAnalysis(actions, analysis);
  }

  return facts;
}

export function shouldAttachSoapPdf(
  analysis: ClassificationResult,
  facts: ProcessorFacts
): boolean {
  if (analysis.attachSoapPdf === false) return false;
  if (analysis.isPolicyQuestion) return false;
  if (!(analysis.systemActions ?? []).includes("fetch_soap_note")) {
    return false;
  }
  return !!(facts.soapNotePdfAttached && facts.soapNote);
}

/** Shared email/chat PDF decision (AI attachSoapPdf + policy + SOAP facts). */
export function resolveOutboundSoapAttachment(
  analysis: ClassificationResult | undefined,
  facts: ProcessorFacts
): { attach: boolean; soapNote: ProcessorFacts["soapNote"] } {
  const note = facts.soapNote;
  if (!note) return { attach: false, soapNote: undefined };

  if (analysis) {
    return {
      attach: shouldAttachSoapPdf(analysis, facts),
      soapNote: note,
    };
  }

  const legacyAttach =
    facts.attachSoapPdf !== false &&
    !facts.isPolicyQuestion &&
    !!facts.soapNotePdfAttached;
  return { attach: legacyAttach, soapNote: note };
}
