import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { MigrationBanner } from "@/components/dashboard/migration-banner";
import { getDashboardStats } from "@/lib/supabase/dashboard-stats";
import { checkSupabaseConnection } from "@/lib/supabase/health";
import {
  checkSchemaHealth,
  isMissingRelationError,
  migrationSetupHint,
} from "@/lib/supabase/schema-health";
import { RefreshButton } from "./refresh-button";

export const dynamic = "force-dynamic";

export default async function HomeDashboardPage() {
  const health = await checkSupabaseConnection();
  const schema = health.connected ? await checkSchemaHealth() : null;
  let stats: Awaited<ReturnType<typeof getDashboardStats>> | null = null;
  let error: string | null = null;

  if (health.connected) {
    try {
      stats = await getDashboardStats();
    } catch (e) {
      error = isMissingRelationError(e)
        ? `Dashboard tables missing. ${migrationSetupHint()}`
        : e instanceof Error
          ? e.message
          : "Failed to load dashboard stats";
    }
  } else {
    error = health.error ?? "Supabase not connected";
  }

  return (
    <>
      <div className="page-title-row">
        <h2 style={{ marginTop: 0 }}>Home</h2>
        <RefreshButton />
      </div>
      <p className="muted">
        Overview of patient email automation — live metrics and charts from
        Supabase.
      </p>

      {schema?.pendingMigration && (
        <MigrationBanner
          missingOpenaiUsage={!schema.openaiUsageLogs}
          missingAdminRules={!schema.adminRules}
          missingThreadRatings={!schema.threadRatings}
        />
      )}

      {error && (
        <p style={{ color: "var(--danger)" }}>{error}</p>
      )}

      {stats && (
        <>
          <MetricsCards metrics={stats.metrics} />
          <DashboardCharts stats={stats} />
        </>
      )}
    </>
  );
}
