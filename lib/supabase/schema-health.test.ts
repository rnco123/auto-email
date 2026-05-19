import { describe, expect, it } from "vitest";
import { isMissingRelationError, migrationSetupHint } from "./schema-health";

describe("isMissingRelationError", () => {
  it("detects Postgres missing relation", () => {
    expect(
      isMissingRelationError({ code: "42P01", message: "relation missing" })
    ).toBe(true);
  });

  it("detects PostgREST schema cache errors", () => {
    expect(
      isMissingRelationError({
        code: "PGRST205",
        message: "Could not find the table public.openai_usage_logs",
      })
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isMissingRelationError({ code: "23505", message: "duplicate" })).toBe(
      false
    );
    expect(isMissingRelationError(null)).toBe(false);
  });
});

describe("migrationSetupHint", () => {
  it("references RUN_PENDING.sql", () => {
    expect(migrationSetupHint()).toContain("RUN_PENDING.sql");
  });
});
