import { describe, expect, it } from "vitest";
import { extractIdentityFromText } from "@/lib/email/extract-identity";

describe("extractIdentityFromText", () => {
  it("parses Name: and DOB: lines", () => {
    const t = "Name: Aleeza Hussain\nDOB: 2026-03-01";
    const h = extractIdentityFromText(t);
    expect(h.name).toBe("Aleeza Hussain");
    expect(h.dob).toBe("2026-03-01");
    expect(h.firstName).toBe("Aleeza");
    expect(h.lastName).toBe("Hussain");
  });

  it("parses first_name / last_name key-value", () => {
    const t =
      "first_name: Meera\nlast_name: Khan\ndate_of_birth: 2001-04-25";
    const h = extractIdentityFromText(t);
    expect(h.name).toContain("Meera");
    expect(h.name).toContain("Khan");
    expect(h.dob).toBe("2001-04-25");
  });

  it("parses prose my name is …", () => {
    const t = "My name is Jane Doe\n\nThanks";
    const h = extractIdentityFromText(t);
    expect(h.name).toMatch(/jane doe/i);
  });

  it("parses Name: and DOB: inline in one sentence", () => {
    const t =
      "I need a soap note pdf please Name: Aleeza Hussain DOB: 2026-03-01";
    const h = extractIdentityFromText(t);
    expect(h.name).toBe("Aleeza Hussain");
    expect(h.dob).toBe("2026-03-01");
    expect(h.firstName).toBe("Aleeza");
    expect(h.lastName).toBe("Hussain");
  });
});
