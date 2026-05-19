import { describe, expect, it } from "vitest";
import { extractIdentityFromText } from "@/lib/email/extract-identity";
import type { EmailThread } from "@/lib/types";

/** Mirrors fallback merge used when API JSON is loose or missing fields. */
function mergeFromThread(
  bodies: string[],
  lastIntent: EmailThread["last_intent"]
) {
  let name: string | null = null;
  let dob: string | null = null;
  for (const body of bodies) {
    const h = extractIdentityFromText(body);
    name = name ?? h.name;
    dob = dob ?? h.dob;
  }
  const soap = lastIntent === "soap_note" || /soap/i.test(bodies.join(" "));
  return { name, dob, soap };
}

describe("analyze fallback identity merge", () => {
  const thread: EmailThread = {
    id: "t1",
    patient_email: "p@example.com",
    subject: "Chat",
    status: "active",
    last_intent: "soap_note",
    verified_patient_id: null,
    message_id_root: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it("combines first name from turn 1 and DOB from turn 2", () => {
    const bodies = [
      "Can i get soap note my name is aleeza",
      "My name is aleeza hussain and I born on March 1, 2026.",
    ];
    const merged = mergeFromThread(bodies, thread.last_intent);
    expect(merged.soap).toBe(true);
    expect(merged.name?.toLowerCase()).toContain("aleeza");
    expect(merged.dob).toBeTruthy();
  });
});
