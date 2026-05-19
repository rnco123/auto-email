import { describe, expect, it } from "vitest";
import { effectiveIntentFromAnalysis } from "@/lib/email/effective-intent";
import { shouldAttachSoapPdf } from "@/lib/email/execute-system-actions";
import type { ClassificationResult, ProcessorFacts } from "@/lib/types";

describe("AI-driven policy turn (no regex routing)", () => {
  const policyAnalysis: ClassificationResult = {
    intent: "general_info",
    effectiveIntent: "general_info",
    systemActions: ["none"],
    extractedName: "Aleeza Hussain",
    extractedFirstName: null,
    extractedLastName: null,
    extractedDob: "2026-03-01",
    extractedLocationHint: null,
    extractedEncounterDate: null,
    replyStrategy:
      "Explain that SOAP notes are only provided for the verified patient, not others. Do not resend PDF.",
    isPolicyQuestion: true,
    attachSoapPdf: false,
    confidence: 0.9,
  };

  it("uses AI effectiveIntent for thread label", () => {
    expect(
      effectiveIntentFromAnalysis(policyAnalysis, { last_intent: "soap_note" })
    ).toBe("general_info");
  });

  it("skips PDF when AI says not to attach", () => {
    const facts: ProcessorFacts = { soapNotePdfAttached: true };
    expect(shouldAttachSoapPdf(policyAnalysis, facts)).toBe(false);
  });
});
