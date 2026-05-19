import type { DashboardMetricCards } from "@/lib/supabase/dashboard-stats";

const CARDS: {
  key: keyof DashboardMetricCards;
  label: string;
  format?: (v: number | null) => string;
}[] = [
  { key: "emailsReceived", label: "Emails received" },
  { key: "inSystemEmails", label: "In-system emails" },
  { key: "newEmails", label: "New emails (7d)" },
  { key: "queriesResolved", label: "Queries resolved" },
  {
    key: "avgRating",
    label: "Avg rating",
    format: (v) => (v == null ? "—" : `${v} / 5`),
  },
];

export function MetricsCards({ metrics }: { metrics: DashboardMetricCards }) {
  return (
    <div className="metrics-grid">
      {CARDS.map(({ key, label, format }) => {
        const raw = metrics[key];
        const display =
          format?.(raw as number | null) ??
          String(typeof raw === "number" ? raw : "—");
        return (
          <article key={key} className="metric-card">
            <span className="metric-card-label">{label}</span>
            <span className="metric-card-value">{display}</span>
          </article>
        );
      })}
    </div>
  );
}
