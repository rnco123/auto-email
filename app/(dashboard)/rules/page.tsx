import { RulesAdminClient } from "@/components/dashboard/rules-admin-client";

export default function RulesPage() {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Rules & policies</h2>
      <p className="muted">
        Built-in and custom rules governing the AI assistant. Active rules are
        injected into analyze and reply prompts. If the rules table is missing,
        run <code>supabase/migrations/RUN_PENDING.sql</code> in the Supabase SQL
        Editor to create and seed defaults.
      </p>
      <RulesAdminClient />
    </>
  );
}
