import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./client";

export type SchemaHealth = {
  openaiUsageLogs: boolean;
  adminRules: boolean;
  threadRatings: boolean;
  pendingMigration: boolean;
};

export const RUN_PENDING_MIGRATION_FILE = "supabase/migrations/RUN_PENDING.sql";

export function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as PostgrestError;
  const msg = e.message ?? "";
  return (
    e.code === "42P01" ||
    e.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("Could not find the table") ||
    msg.includes("schema cache")
  );
}

export function migrationSetupHint(): string {
  return `Run ${RUN_PENDING_MIGRATION_FILE} in the Supabase SQL Editor (Dashboard → SQL → New query → paste → Run).`;
}

async function tableExists(table: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(table)
    .select("*", { head: true, count: "exact" });
  return !error;
}

export async function checkSchemaHealth(): Promise<SchemaHealth> {
  const [openaiUsageLogs, adminRules, threadRatings] = await Promise.all([
    tableExists("openai_usage_logs"),
    tableExists("admin_rules"),
    tableExists("thread_ratings"),
  ]);

  return {
    openaiUsageLogs,
    adminRules,
    threadRatings,
    pendingMigration: !openaiUsageLogs || !adminRules || !threadRatings,
  };
}
