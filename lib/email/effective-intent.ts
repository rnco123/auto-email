import type { ClassificationResult, EmailIntent } from "@/lib/types";

const ROUTING_INTENTS: EmailIntent[] = [
  "appointment",
  "location",
  "general_info",
  "soap_note",
  "greeting",
  "unknown",
];

function isRoutingIntent(intent: EmailIntent): boolean {
  return ROUTING_INTENTS.includes(intent);
}

/**
 * Thread intent label from AI analysis only (no regex overrides).
 */
export function effectiveIntentFromAnalysis(
  analysis: ClassificationResult,
  thread: { last_intent: EmailIntent | null }
): EmailIntent {
  const candidate = analysis.effectiveIntent ?? analysis.intent;

  if (isRoutingIntent(candidate)) {
    return candidate;
  }

  if (thread.last_intent && isRoutingIntent(thread.last_intent)) {
    return thread.last_intent;
  }

  return "general_info";
}
