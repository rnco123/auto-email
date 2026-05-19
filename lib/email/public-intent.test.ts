import { describe, expect, it } from "vitest";
import { resolveIntent } from "@/lib/email/public-intent";

describe("resolveIntent (verification disabled)", () => {
  it("prefers location question over soap thread when body asks for addresses", () => {
    const intent = resolveIntent(
      "unknown",
      "What are your clinic locations?",
      "soap_note",
      true
    );
    expect(intent).toBe("location");
  });

  it("keeps soap follow-up when last intent is soap_note and body only has DOB hints", () => {
    expect(
      resolveIntent("provide_dob", "DOB: 2001-01-01", "soap_note", true)
    ).toBe("soap_note");
  });

  it("keeps soap thread on status follow-up", () => {
    expect(
      resolveIntent("unknown", "any update?", "soap_note", true)
    ).toBe("soap_note");
  });
});
