import { describe, expect, it } from "vitest";
import { detectPatientLanguage } from "@/lib/i18n/patient-language";

describe("detectPatientLanguage", () => {
  it("detects Spanish", () => {
    expect(
      detectPatientLanguage(
        "Hola, necesito mi nota SOAP por favor. Mi nombre es Aleeza."
      )
    ).toBe("es");
  });

  it("detects English", () => {
    expect(
      detectPatientLanguage("Hello, I need my SOAP note please.")
    ).toBe("en");
  });
});
