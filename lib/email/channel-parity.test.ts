import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { enrichFactsForReply } from "@/lib/email/process-patient-turn";
import * as processPatientTurnModule from "@/lib/email/process-patient-turn";
import { simulateOpenAccessChatTurn } from "@/lib/email/simulate-chat-turn";
import { appendResolutionPrompt } from "@/lib/supabase/thread-feedback";
import type { ClassificationResult, EmailThread, ProcessorFacts } from "@/lib/types";

const analysisStub: ClassificationResult = {
  intent: "soap_note",
  effectiveIntent: "soap_note",
  systemActions: ["lookup_patient", "fetch_soap_note"],
  extractedName: "Jane Doe",
  extractedFirstName: "Jane",
  extractedLastName: "Doe",
  extractedDob: "1990-01-01",
  extractedLocationHint: null,
  extractedEncounterDate: null,
  replyStrategy: "Send SOAP PDF.",
  attachSoapPdf: true,
  isPolicyQuestion: false,
  issueLikelyResolved: true,
  shouldAskResolutionFeedback: true,
  confidence: 0.9,
};

const threadStub: EmailThread = {
  id: "chat-sim",
  patient_email: "jane@example.com",
  subject: "Chat",
  status: "active",
  last_intent: null,
  verified_patient_id: null,
  message_id_root: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("channel parity helpers", () => {
  it("enrichFactsForReply mirrors chat/email AI guidance fields", () => {
    const base: ProcessorFacts = { soapNotePdfAttached: true };
    const enriched = enrichFactsForReply(base, {
      analysis: analysisStub,
      intent: "soap_note",
      replyLanguage: "es",
      identityHints: { name: "Jane Doe", dob: "1990-01-01" },
      resolvedPatientId: "p1",
      patientName: "Jane Doe",
      replyChannel: "email",
    });

    expect(enriched.replyLanguage).toBe("es");
    expect(enriched.replyChannel).toBe("email");
    expect(enriched.effectiveIntent).toBe("soap_note");
    expect(enriched.systemActions).toEqual(analysisStub.systemActions);
    expect(enriched.isPolicyQuestion).toBe(false);
    expect(enriched.attachSoapPdf).toBe(true);
    expect(enriched.identityHints).toEqual({
      name: "Jane Doe",
      dob: "1990-01-01",
    });
    expect(enriched.resolvedPatientId).toBe("p1");
  });

  it("resolution prompt is idempotent when already appended (open-access email)", () => {
    const withPrompt = appendResolutionPrompt("Thanks for your visit.", "en");
    const again = appendResolutionPrompt(withPrompt, "en");
    expect(again).toBe(withPrompt);
    expect(withPrompt).toContain("Is your issue resolved?");
  });
});

describe("chat and email share processPatientTurn", () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.DISABLE_PATIENT_VERIFICATION = "true";
    spy = vi.spyOn(processPatientTurnModule, "processPatientTurn").mockResolvedValue({
      intent: "soap_note",
      replyText: "Reply body",
      facts: { replyLanguage: "en" },
      analysis: analysisStub,
      patientId: null,
      patientName: null,
      feedbackPrompt: null,
    });
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it("simulateOpenAccessChatTurn uses replyChannel chat", async () => {
    await simulateOpenAccessChatTurn({
      thread: threadStub,
      transcriptBeforeThisMessage: [],
      patientMessage: "Please send my SOAP note.",
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        replyChannel: "chat",
        patientMessage: "Please send my SOAP note.",
      })
    );
  });
});
