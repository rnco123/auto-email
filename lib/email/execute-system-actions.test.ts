import { describe, expect, it } from "vitest";
import {
  resolveOutboundSoapAttachment,
  shouldAttachSoapPdf,
} from "@/lib/email/execute-system-actions";
import type { ClassificationResult, ProcessorFacts } from "@/lib/types";

describe("shouldAttachSoapPdf", () => {
  const baseAnalysis: ClassificationResult = {
    intent: "general_info",
    effectiveIntent: "general_info",
    systemActions: ["none"],
    extractedName: null,
    extractedFirstName: null,
    extractedLastName: null,
    extractedDob: null,
    extractedLocationHint: null,
    extractedEncounterDate: null,
    isPolicyQuestion: true,
    attachSoapPdf: false,
    confidence: 0.9,
  };

  const soapFacts: ProcessorFacts = {
    soapNotePdfAttached: true,
    soapNote: {
      id: "1",
      encounterId: "e1",
      encounterDate: "2026-03-05",
      subjective: null,
      objective: null,
      assessment: null,
      plan: null,
    },
  };

  it("does not attach PDF for policy questions", () => {
    expect(shouldAttachSoapPdf(baseAnalysis, soapFacts)).toBe(false);
  });

  it("attaches PDF when AI plans fetch_soap_note", () => {
    expect(
      shouldAttachSoapPdf(
        {
          ...baseAnalysis,
          isPolicyQuestion: false,
          systemActions: ["lookup_patient", "fetch_soap_note"],
          attachSoapPdf: true,
        },
        soapFacts
      )
    ).toBe(true);
  });

  it("resolveOutboundSoapAttachment matches shouldAttachSoapPdf", () => {
    const analysis = {
      ...baseAnalysis,
      isPolicyQuestion: false,
      systemActions: ["lookup_patient", "fetch_soap_note"] as const,
      attachSoapPdf: true,
    };
    const withAnalysis = resolveOutboundSoapAttachment(
      {
        ...analysis,
        systemActions: ["lookup_patient", "fetch_soap_note"],
      },
      soapFacts
    );
    expect(withAnalysis.attach).toBe(shouldAttachSoapPdf(analysis, soapFacts));
    expect(withAnalysis.soapNote).toBe(soapFacts.soapNote);
  });

  it("resolveOutboundSoapAttachment blocks policy questions without analysis", () => {
    const policyFacts: ProcessorFacts = {
      ...soapFacts,
      isPolicyQuestion: true,
      attachSoapPdf: false,
    };
    expect(resolveOutboundSoapAttachment(undefined, policyFacts).attach).toBe(
      false
    );
  });
});
