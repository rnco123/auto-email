import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./client";
import { formatSupabaseError } from "./errors";

const ADMIN_RULES_CONTEXT = {
  table: "admin_rules",
  migration: "supabase/migrations/RUN_PENDING.sql",
} as const;

function throwAdminRulesError(error: PostgrestError): never {
  throw new Error(formatSupabaseError(error, ADMIN_RULES_CONTEXT));
}

export type AdminRule = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function listAdminRules(activeOnly = false): Promise<AdminRule[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("admin_rules")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (activeOnly) q = q.eq("active", true);

  const { data, error } = await q;
  if (error) throwAdminRulesError(error);
  return (data ?? []) as AdminRule[];
}

export async function createAdminRule(input: {
  title: string;
  body: string;
  category?: string | null;
  active?: boolean;
  sort_order?: number;
}): Promise<AdminRule> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("admin_rules")
    .insert({
      title: input.title.trim(),
      body: input.body.trim(),
      category: input.category?.trim() || null,
      active: input.active ?? true,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) throwAdminRulesError(error);
  return data as AdminRule;
}

export async function updateAdminRule(
  id: string,
  updates: Partial<{
    title: string;
    body: string;
    category: string | null;
    active: boolean;
    sort_order: number;
  }>
): Promise<AdminRule> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("admin_rules")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throwAdminRulesError(error);
  return data as AdminRule;
}

export async function deleteAdminRule(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("admin_rules").delete().eq("id", id);
  if (error) throwAdminRulesError(error);
}

/** Compact block for OpenAI system prompts. */
export async function formatActiveRulesForPrompt(): Promise<string> {
  const rules = await listAdminRules(true);
  if (rules.length === 0) return "";

  const lines = rules.map(
    (r, i) =>
      `${i + 1}. [${r.category ?? "general"}] ${r.title}: ${r.body}`
  );
  return `Clinic admin rules (follow these in addition to built-in safety):\n${lines.join("\n")}`;
}
