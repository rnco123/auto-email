import type { ApiResult, Turn, TurnDebug } from "./chat-types";

export function formatChatForCopy(
  transcript: Turn[],
  turnHistory: TurnDebug[],
  meta: {
    lastIntent: string;
    verifiedPatientId: string | null;
  }
): string {
  const lines: string[] = [
    "# Dev chat transcript",
    `Exported: ${new Date().toISOString()}`,
    "",
    "## Thread state",
    `- lastIntent: ${meta.lastIntent || "(none)"}`,
    `- verifiedPatientId: ${meta.verifiedPatientId ?? "(none)"}`,
    "",
    "## Conversation",
  ];

  if (transcript.length === 0) {
    lines.push("(empty)");
    return lines.join("\n");
  }

  let turnIndex = 0;
  for (const turn of transcript) {
    const label = turn.role === "patient" ? "PATIENT" : "CLINIC";
    lines.push("", `### ${label}`, turn.text);
    if (turn.attachment?.filename) {
      lines.push(`[attachment: ${turn.attachment.filename}]`);
    }

    if (turn.role === "clinic" && turnHistory[turnIndex]) {
      const debug = turnHistory[turnIndex];
      lines.push("", "#### API (this turn)", `Patient sent: ${debug.patientMessage}`);
      appendApiResult(lines, debug.result);
      turnIndex += 1;
    }
  }

  return lines.join("\n");
}

function appendApiResult(lines: string[], result: ApiResult): void {
  if (result.error) {
    lines.push(`- error: ${result.error}`);
    if (result.fix) lines.push(`- fix: ${result.fix}`);
    return;
  }

  if (result.intent) lines.push(`- intent: ${result.intent}`);
  if (result.effectiveIntent) {
    lines.push(`- effectiveIntent: ${result.effectiveIntent}`);
  }
  if (result.systemActions?.length) {
    lines.push(`- systemActions: ${result.systemActions.join(", ")}`);
  }
  if (result.replyLanguage) {
    lines.push(`- replyLanguage: ${result.replyLanguage}`);
  }
  if (result.confidence != null) {
    lines.push(`- confidence: ${Math.round(result.confidence * 100)}%`);
  }
  if (result.patientId) {
    lines.push(
      `- patientId: ${result.patientId}${result.patientName ? ` (${result.patientName})` : ""}`
    );
  }
  if (result.identityHints?.name) {
    lines.push(
      `- identity: ${result.identityHints.name}${result.identityHints.dob ? ` · DOB ${result.identityHints.dob}` : ""}`
    );
  }
  if (result.factsKeys?.length) {
    lines.push(`- facts: ${result.factsKeys.join(", ")}`);
  }
  if (result.attachment?.filename) {
    lines.push(`- attachment: ${result.attachment.filename}`);
  }
  if (result.replyText) {
    lines.push("", "Clinic reply (raw):", result.replyText);
  }
}
