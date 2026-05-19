import { describe, expect, it } from "vitest";
import { formatSupabaseError, toErrorMessage } from "./errors";

describe("formatSupabaseError", () => {
  it("maps missing table to migration instructions", () => {
    const msg = formatSupabaseError(
      {
        code: "PGRST205",
        message: "Could not find the table 'public.admin_rules' in the schema cache",
        details: null,
        hint: null,
      },
      {
        table: "admin_rules",
        migration: "009_thread_feedback_and_admin_rules.sql",
      }
    );
    expect(msg).toContain("admin_rules");
    expect(msg).toContain("009_thread_feedback_and_admin_rules.sql");
  });

  it("maps permission denied to grants guidance", () => {
    const msg = formatSupabaseError(
      {
        code: "42501",
        message: "permission denied for table admin_rules",
        details: null,
        hint: null,
      },
      {
        table: "admin_rules",
        migration: "009_thread_feedback_and_admin_rules.sql",
      }
    );
    expect(msg).toContain("Permission denied");
    expect(msg).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});

describe("toErrorMessage", () => {
  it("uses Error.message when present", () => {
    expect(toErrorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("falls back for unknown values", () => {
    expect(toErrorMessage(null, "fallback")).toBe("fallback");
  });
});
