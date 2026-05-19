import { describe, expect, it } from "vitest";
import {
  dobMatches,
  dobToIsoDateString,
  namesMatch,
  normalizeName,
  parseDobParts,
} from "@/lib/supabase/clinical-queries";

describe("parseDobParts / dobToIsoDateString", () => {
  it("parses ISO and US formats", () => {
    expect(parseDobParts("2026-03-01")).toEqual({
      year: 2026,
      month: 3,
      day: 1,
    });
    expect(dobToIsoDateString("3/1/2026")).toBe("2026-03-01");
    expect(dobToIsoDateString("03-01-2026")).toBe("2026-03-01");
  });

  it("returns null for garbage", () => {
    expect(parseDobParts("not a date")).toBeNull();
    expect(dobToIsoDateString("")).toBeNull();
  });
});

describe("dobMatches", () => {
  it("matches DB ISO to patient-provided variants", () => {
    expect(dobMatches("2026-03-01", "2026-03-01")).toBe(true);
    expect(dobMatches("2026-03-01", "3/1/2026")).toBe(true);
    expect(dobMatches("2026-03-01", "2000-01-01")).toBe(false);
  });
});

describe("namesMatch", () => {
  it("matches first+last ignoring case and punctuation", () => {
    expect(
      namesMatch("Aleeza Hussain", "aleeza hussain")
    ).toBe(true);
    expect(
      namesMatch("Aleeza Hussain", "Aleeza Z. Hussain")
    ).toBe(true);
    expect(namesMatch("Jane Doe", "John Doe")).toBe(false);
  });

  it("normalizeName strips non-letters", () => {
    expect(normalizeName("O'Brien")).toContain("obrien");
  });
});
