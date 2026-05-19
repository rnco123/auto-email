import { describe, expect, it } from "vitest";
import {
  inferIntentFromRecentClinicReplies,
  inferPriorIntent,
} from "@/lib/email/infer-thread-intent";
import type { EmailMessage } from "@/lib/types";

function outbound(body: string, created: string): EmailMessage {
  return {
    id: `msg-${created}`,
    thread_id: "t1",
    direction: "outbound",
    resend_email_id: null,
    body_text: body,
    raw_metadata: null,
    created_at: created,
  };
}

describe("inferIntentFromRecentClinicReplies", () => {
  it("returns soap_note when clinic asked for SOAP + identity", () => {
    const history: EmailMessage[] = [
      outbound(
        "To send your SOAP note, please reply with your full name and date of birth.",
        "2026-01-01T10:00:00Z"
      ),
    ];
    expect(inferIntentFromRecentClinicReplies(history)).toBe("soap_note");
  });

  it("returns soap_note for visit-date disambiguation", () => {
    const history: EmailMessage[] = [
      outbound(
        "We have more than one visit on file. Which visit date do you need?",
        "2026-01-02T10:00:00Z"
      ),
    ];
    expect(inferIntentFromRecentClinicReplies(history)).toBe("soap_note");
  });

  it("returns appointment when clinic discussed scheduling", () => {
    const history: EmailMessage[] = [
      outbound(
        "Your upcoming appointment is next Tuesday. Let us know if you need to reschedule.",
        "2026-01-03T10:00:00Z"
      ),
    ];
    expect(inferIntentFromRecentClinicReplies(history)).toBe("appointment");
  });

  it("returns null when no outbound context", () => {
    expect(inferIntentFromRecentClinicReplies([])).toBeNull();
  });

  it("does not treat vague appointment wording as appointment intent", () => {
    const history: EmailMessage[] = [
      outbound(
        "Thank you for your name and DOB. I am still locating your chart to check your appointment details.",
        "2026-01-04T10:00:00Z"
      ),
    ];
    expect(inferIntentFromRecentClinicReplies(history)).toBeNull();
  });
});

describe("inferPriorIntent", () => {
  it("maps synthetic provide_* thread intents to appointment", () => {
    expect(inferPriorIntent("provide_dob")).toBe("appointment");
    expect(inferPriorIntent("soap_note")).toBe("soap_note");
  });
});
