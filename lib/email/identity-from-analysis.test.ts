import { describe, expect, it } from "vitest";
import { identityFromAnalysis } from "@/lib/email/identity-from-analysis";
import type { ClassificationResult } from "@/lib/types";

function analysis(
  partial: Partial<ClassificationResult>
): ClassificationResult {
  return {
    intent: "soap_note",
    extractedName: null,
    extractedFirstName: null,
    extractedLastName: null,
    extractedDob: null,
    extractedLocationHint: null,
    extractedEncounterDate: null,
    confidence: 1,
    ...partial,
  };
}

describe("identityFromAnalysis", () => {
  it("uses AI-extracted full name and DOB", () => {
    const hints = identityFromAnalysis(
      analysis({
        extractedName: "Aleeza Hussain",
        extractedDob: "2026-03-01",
      })
    );
    expect(hints.name).toBe("Aleeza Hussain");
    expect(hints.dob).toBe("2026-03-01");
  });

  it("builds full name from first and last", () => {
    const hints = identityFromAnalysis(
      analysis({
        extractedFirstName: "Aleeza",
        extractedLastName: "Hussain",
        extractedDob: "2026-03-01",
      })
    );
    expect(hints.name).toBe("Aleeza Hussain");
  });

  it("fills DOB from thread bodies when AI omitted it", () => {
    const hints = identityFromAnalysis(
      analysis({ extractedName: "Aleeza Hussain" }),
      {
        patientBodies: [
          "My name is aleeza hussain and I born on March 1, 2026.",
        ],
      }
    );
    expect(hints.name).toMatch(/aleeza hussain/i);
    expect(hints.dob).toBeTruthy();
  });
});
