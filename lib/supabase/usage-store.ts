import { getSupabaseAdmin } from "./client";
import { formatSupabaseError } from "./errors";

const USAGE_ERROR_CONTEXT = {
  table: "openai_usage_logs",
  migration: "supabase/migrations/RUN_PENDING.sql",
} as const;

export interface OpenAIUsageLogRow {
  id: string;
  created_at: string;
  model: string;
  operation: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  thread_id: string | null;
}

export type UsageDailyPoint = {
  date: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
};

export type UsageByOperation = {
  operation: string;
  totalTokens: number;
  costUsd: number;
};

export type UsageSummary = {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  byDay: UsageDailyPoint[];
  byOperation: UsageByOperation[];
  recent: OpenAIUsageLogRow[];
};

const USAGE_CHART_DAYS = 30;

export function emptyUsageSummary(): UsageSummary {
  const dayKeys = lastNDays(USAGE_CHART_DAYS);
  return {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    byDay: dayKeys.map((date) => ({
      date,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
    })),
    byOperation: [],
    recent: [],
  };
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export async function getUsageSummary(): Promise<UsageSummary> {
  const supabase = getSupabaseAdmin();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - USAGE_CHART_DAYS);

  const { data, error } = await supabase
    .from("openai_usage_logs")
    .select("*")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error) throw new Error(formatSupabaseError(error, USAGE_ERROR_CONTEXT));

  const rows = (data ?? []) as OpenAIUsageLogRow[];
  const dayKeys = lastNDays(USAGE_CHART_DAYS);
  const dayMap = new Map<string, UsageDailyPoint>();
  for (const date of dayKeys) {
    dayMap.set(date, {
      date,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
    });
  }

  const opMap = new Map<string, UsageByOperation>();
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;
  let totalCostUsd = 0;

  for (const row of rows) {
    totalPromptTokens += row.prompt_tokens;
    totalCompletionTokens += row.completion_tokens;
    totalTokens += row.total_tokens;
    totalCostUsd += Number(row.estimated_cost_usd);

    const dateKey = row.created_at.slice(0, 10);
    const day = dayMap.get(dateKey);
    if (day) {
      day.promptTokens += row.prompt_tokens;
      day.completionTokens += row.completion_tokens;
      day.totalTokens += row.total_tokens;
      day.costUsd += Number(row.estimated_cost_usd);
    }

    const op = opMap.get(row.operation) ?? {
      operation: row.operation,
      totalTokens: 0,
      costUsd: 0,
    };
    op.totalTokens += row.total_tokens;
    op.costUsd += Number(row.estimated_cost_usd);
    opMap.set(row.operation, op);
  }

  for (const day of dayMap.values()) {
    day.costUsd = Math.round(day.costUsd * 1_000_000) / 1_000_000;
  }

  return {
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
    byDay: dayKeys.map((date) => dayMap.get(date)!),
    byOperation: [...opMap.values()].sort(
      (a, b) => b.totalTokens - a.totalTokens
    ),
    recent: rows.slice(0, 50),
  };
}
