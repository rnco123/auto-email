"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardStats } from "@/lib/supabase/dashboard-stats";

const PIE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#64748b",
];

function formatShortDate(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function DashboardCharts({ stats }: { stats: DashboardStats }) {
  const intentData =
    stats.intentBreakdown.length > 0
      ? stats.intentBreakdown
      : [{ intent: "none", count: 1 }];

  const statusData =
    stats.threadStatusBreakdown.length > 0
      ? stats.threadStatusBreakdown
      : [{ status: "active", count: 0 }];

  return (
    <div className="charts-grid">
      <section className="chart-panel">
        <h3 className="chart-panel-title">Email volume (14 days)</h3>
        <div className="chart-panel-body">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stats.volumeByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                stroke="#8b9cb3"
                fontSize={12}
              />
              <YAxis stroke="#8b9cb3" fontSize={12} allowDecimals={false} />
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
                dataKey="inbound"
                name="Inbound"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="outbound"
                name="Outbound"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="chart-panel">
        <h3 className="chart-panel-title">Threads by status</h3>
        <div className="chart-panel-body">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
              <XAxis dataKey="status" stroke="#8b9cb3" fontSize={12} />
              <YAxis stroke="#8b9cb3" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "#1a2332",
                  border: "1px solid #2d3a4f",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="count" name="Threads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="chart-panel chart-panel-wide">
        <h3 className="chart-panel-title">Intent distribution</h3>
        <div className="chart-panel-body chart-panel-split">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={intentData}
                dataKey="count"
                nameKey="intent"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ intent, percent }) =>
                  `${intent} ${(percent * 100).toFixed(0)}%`
                }
              >
                {intentData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#1a2332",
                  border: "1px solid #2d3a4f",
                  borderRadius: 8,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
