import type { EmailIntent, PublicReplyScope } from "@/lib/types";

const SERVICE_PATTERNS =
  /\b(services?|what\s+services|what do you (offer|provide|treat)|treatments?|specialt(y|ies)|conditions? (you )?treat|medical services)\b/i;

const LOCATION_PATTERNS =
  /\b(address|address(es)?|location|locations|where are you|directions|office hours|opening hours|which clinic|nearest clinic|find (a |the )?clinic)\b/i;

/** What public data to include — only what the patient asked for. */
export function detectPublicReplyScope(body: string, intent: EmailIntent): PublicReplyScope {
  const wantsServices = SERVICE_PATTERNS.test(body);
  const wantsLocations = LOCATION_PATTERNS.test(body);

  if (wantsServices && !wantsLocations) return "services";
  if (wantsLocations && !wantsServices) return "locations";
  if (wantsServices && wantsLocations) return "both";

  if (intent === "location") return "locations";
  if (intent === "general_info") return "both";

  return "none";
}
