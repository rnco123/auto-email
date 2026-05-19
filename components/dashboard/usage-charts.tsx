"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UsageSummary } from "@/lib/supabase/usage-store";

function formatShortDate(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(n);
}

type UsageChartsProps = {
  summary: UsageSummary;
  classifyModel: string;
  replyModel: string;
};

export function UsageCharts({
  summary,
  classifyModel,
  replyModel,
}: UsageChartsProps) {
  const tokenSeries = summary.byDay.map((d) => ({
    ...d,
    costUsd: Math.round(d.costUsd * 1_000_000) / 1_000_000,
  }));

  return (
    <>
      <p className="muted usage-models">
        Models: classify <code>{classifyModel}</code> · reply{" "}
        <code>{replyModel}</code> — costs estimated from OpenAI list pricing.
      </p>

      <div className="usage-totals">
        <article className="metric-card">
          <span className="metric-card-label">Prompt tokens (30d)</span>
          <span className="metric-card-value">
            {summary.totalPromptTokens.toLocaleString()}
          </span>
        </article>
        <article className="metric-card">
          <span className="metric-card-label">Completion tokens (30d)</span>
          <span className="metric-card-value">
            {summary.totalCompletionTokens.toLocaleString()}
          </span>
        </article>
        <article className="metric-card">
          <span className="metric-card-label">Total tokens (30d)</span>
          <span className="metric-card-value">
            {summary.totalTokens.toLocaleString()}
          </span>
        </article>
        <article className="metric-card metric-card-accent">
          <span className="metric-card-label">Est. cost USD (30d)</span>
          <span className="metric-card-value">
            {formatUsd(summary.totalCostUsd)}
          </span>
        </article>
      </div>

      <div className="charts-grid">
        <section className="chart-panel chart-panel-wide">
          <h3 className="chart-panel-title">Tokens over time</h3>
          <div className="chart-panel-body">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={tokenSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  stroke="#8b9cb3"
                  fontSize={12}
                />
                <YAxis stroke="#8b9cb3" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "#1a2332",
                    border: "1px solid #2d3a4f",
                    borderRadius: 8,
                  }}
                  labelFormatter={formatShortDate}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="promptTokens"
                  name="Prompt"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="completionTokens"
                  name="Completion"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-panel">
          <h3 className="chart-panel-title">Cost by operation</h3>
          <div className="chart-panel-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={summary.byOperation}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
                <XAxis dataKey="operation" stroke="#8b9cb3" fontSize={12} />
                <YAxis stroke="#8b9cb3" fontSize={12} />
                <Tooltip
                  formatter={(value: number) => formatUsd(value)}
                  contentStyle={{
                    background: "#1a2332",
                    border: "1px solid #2d3a4f",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="costUsd" name="USD" fill="#eab308" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {summary.recent.length > 0 && (
        <>
          <h3 className="section-heading">Recent API calls</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Operation</th>
                <th>Model</th>
                <th>Prompt</th>
                <th>Completion</th>
                <th>Total</th>
                <th>Est. USD</th>
              </tr>
            </thead>
            <tbody>
              {summary.recent.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>{row.operation}</td>
                  <td>
                    <code>{row.model}</code>
                  </td>
                  <td>{row.prompt_tokens}</td>
                  <td>{row.completion_tokens}</td>
                  <td>{row.total_tokens}</td>
                  <td>{formatUsd(Number(row.estimated_cost_usd))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
