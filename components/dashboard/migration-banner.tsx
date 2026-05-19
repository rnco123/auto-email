import { RUN_PENDING_MIGRATION_FILE } from "@/lib/supabase/schema-health";

type MigrationBannerProps = {
  missingOpenaiUsage?: boolean;
  missingAdminRules?: boolean;
  missingThreadRatings?: boolean;
};

export function MigrationBanner({
  missingOpenaiUsage,
  missingAdminRules,
  missingThreadRatings,
}: MigrationBannerProps) {
  const items: string[] = [];
  if (missingOpenaiUsage) items.push("openai_usage_logs");
  if (missingAdminRules) items.push("admin_rules");
  if (missingThreadRatings) items.push("thread_ratings");

  if (items.length === 0) return null;

  return (
    <div
      className="migration-banner"
      role="status"
      style={{
        marginBottom: "1.25rem",
        padding: "0.75rem 1rem",
        borderRadius: 8,
        border: "1px solid var(--warn, #eab308)",
        background: "rgba(234, 179, 8, 0.08)",
      }}
    >
      <strong>Database setup required.</strong> Missing table
      {items.length > 1 ? "s" : ""}:{" "}
      {items.map((name, i) => (
        <span key={name}>
          {i > 0 && ", "}
          <code>{name}</code>
        </span>
      ))}
      . Open Supabase → SQL Editor, paste and run{" "}
      <code>{RUN_PENDING_MIGRATION_FILE}</code> (migrations 008 + 009).
    </div>
  );
}
