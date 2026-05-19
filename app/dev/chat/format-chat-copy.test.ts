import { describe, expect, it } from "vitest";
import { formatChatForCopy } from "./format-chat-copy";

describe("formatChatForCopy", () => {
  it("includes conversation and per-turn API debug", () => {
    const text = formatChatForCopy(
      [
        { role: "patient", text: "I need my SOAP note." },
        { role: "clinic", text: "Please send name and DOB." },
      ],
      [
        {
          patientMessage: "I need my SOAP note.",
          result: {
            intent: "soap_note",
            factsKeys: ["needsPatientForSoap"],
            replyText: "Please send name and DOB.",
          },
        },
      ],
      { lastIntent: "soap_note", verifiedPatientId: null }
    );

    expect(text).toContain("PATIENT");
    expect(text).toContain("I need my SOAP note.");
    expect(text).toContain("intent: soap_note");
    expect(text).toContain("needsPatientForSoap");
  });
});
