import type { PostgrestError } from "@supabase/supabase-js";

export type SupabaseErrorContext = {
  table?: string;
  migration?: string;
};

export function isPostgrestError(e: unknown): e is PostgrestError {
  return (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as PostgrestError).message === "string"
  );
}

export function formatSupabaseError(
  error: PostgrestError,
  context?: SupabaseErrorContext
): string {
  const table = context?.table ?? "table";
  const migration = context?.migration ?? "the relevant migration";

  if (
    error.code === "PGRST205" ||
    error.message.includes("Could not find the table")
  ) {
    return `Database table "${table}" is missing. Run migration ${migration} in the Supabase SQL editor (or supabase db push), then reload this page.`;
  }

  if (
    error.code === "42501" ||
    error.message.toLowerCase().includes("permission denied")
  ) {
    return `Permission denied on "${table}". Apply migration ${migration} (includes table grants), or set SUPABASE_SERVICE_ROLE_KEY for the dashboard API.`;
  }

  return error.message || "Database error";
}

export function toErrorMessage(
  e: unknown,
  fallback: string,
  context?: SupabaseErrorContext
): string {
  if (isPostgrestError(e)) return formatSupabaseError(e, context);
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
