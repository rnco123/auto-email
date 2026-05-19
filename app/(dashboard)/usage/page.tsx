import { UsageCharts } from "@/components/dashboard/usage-charts";
import { MigrationBanner } from "@/components/dashboard/migration-banner";
import {
  emptyUsageSummary,
  getUsageSummary,
} from "@/lib/supabase/usage-store";
import { checkSupabaseConnection } from "@/lib/supabase/health";
import {
  checkSchemaHealth,
  isMissingRelationError,
} from "@/lib/supabase/schema-health";
import { RefreshButton } from "../refresh-button";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const health = await checkSupabaseConnection();
  const schema = health.connected ? await checkSchemaHealth() : null;
  let summary = emptyUsageSummary();
  let error: string | null = null;
  let showCharts = false;

  if (!health.connected) {
    error = health.error ?? "Supabase not connected";
  } else if (!schema?.openaiUsageLogs) {
    showCharts = true;
  } else {
    try {
      summary = await getUsageSummary();
      showCharts = true;
    } catch (e) {
      if (isMissingRelationError(e)) {
        showCharts = true;
      } else {
        error = e instanceof Error ? e.message : "Failed to load usage";
      }
    }
  }

  return (
    <>
      <div className="page-title-row">
        <h2 style={{ marginTop: 0 }}>OpenAI usage</h2>
        <RefreshButton />
      </div>

      <p className="muted">
        Token and cost estimates from <code>openai_usage_logs</code> (last 30
        days).
      </p>

      {schema?.pendingMigration && (
        <MigrationBanner
          missingOpenaiUsage={!schema.openaiUsageLogs}
          missingAdminRules={!schema.adminRules}
          missingThreadRatings={!schema.threadRatings}
        />
      )}

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {showCharts && (
        <UsageCharts
          summary={summary}
          classifyModel={process.env.OPENAI_CLASSIFY_MODEL ?? "gpt-4o-mini"}
          replyModel={process.env.OPENAI_REPLY_MODEL ?? "gpt-4o-mini"}
        />
      )}
    </>
  );
}
