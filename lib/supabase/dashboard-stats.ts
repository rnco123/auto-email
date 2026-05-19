import { getSupabaseAdmin } from "./client";

export type DashboardMetricCards = {
  emailsReceived: number;
  inSystemEmails: number;
  newEmails: number;
  queriesResolved: number;
  avgRating: number | null;
};

export type DailyVolumePoint = {
  date: string;
  inbound: number;
  outbound: number;
};

export type IntentBreakdownPoint = {
  intent: string;
  count: number;
};

export type ThreadStatusPoint = {
  status: string;
  count: number;
};

export type DashboardStats = {
  metrics: DashboardMetricCards;
  volumeByDay: DailyVolumePoint[];
  intentBreakdown: IntentBreakdownPoint[];
  threadStatusBreakdown: ThreadStatusPoint[];
};

const NEW_EMAIL_DAYS = 7;
const CHART_DAYS = 14;

function startOfDayUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(startOfDayUtc(d));
  }
  return days;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = getSupabaseAdmin();
  const sinceNew = new Date();
  sinceNew.setUTCDate(sinceNew.getUTCDate() - NEW_EMAIL_DAYS);
  const sinceChart = new Date();
  sinceChart.setUTCDate(sinceChart.getUTCDate() - CHART_DAYS);

  const [
    inboundRes,
    outboundRes,
    threadRes,
    newInboundRes,
    resolvedJobsRes,
    verifiedThreadsRes,
    ratingsRes,
    recentMessagesRes,
    threadsByIntentRes,
    threadsByStatusRes,
  ] = await Promise.all([
    supabase
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound"),
    supabase
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "outbound"),
    supabase.from("email_threads").select("id", { count: "exact", head: true }),
    supabase
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .gte("created_at", sinceNew.toISOString()),
    supabase
      .from("email_processing_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase
      .from("email_threads")
      .select("id", { count: "exact", head: true })
      .eq("status", "verified"),
    supabase
      .from("thread_ratings")
      .select("rating")
      .gte("rating", 1)
      .lte("rating", 5),
    supabase
      .from("email_messages")
      .select("direction, created_at")
      .gte("created_at", sinceChart.toISOString())
      .order("created_at", { ascending: true }),
    supabase
      .from("email_threads")
      .select("last_intent")
      .not("last_intent", "is", null),
    supabase.from("email_threads").select("status"),
  ]);

  const emailsReceived = inboundRes.count ?? 0;
  const outboundCount = outboundRes.count ?? 0;
  const inSystemEmails = emailsReceived + outboundCount;
  const newEmails = newInboundRes.count ?? 0;
  const queriesResolved =
    (resolvedJobsRes.count ?? 0) + (verifiedThreadsRes.count ?? 0);

  let avgRating: number | null = null;
  const ratings = (ratingsRes.data ?? []) as { rating: number }[];
  if (ratings.length > 0) {
    const sum = ratings.reduce((a, r) => a + r.rating, 0);
    avgRating = Math.round((sum / ratings.length) * 10) / 10;
  }

  const dayKeys = lastNDays(CHART_DAYS);
  const volumeMap = new Map<string, { inbound: number; outbound: number }>();
  for (const key of dayKeys) {
    volumeMap.set(key, { inbound: 0, outbound: 0 });
  }

  for (const row of recentMessagesRes.data ?? []) {
    const r = row as { direction: string; created_at: string };
    const key = r.created_at.slice(0, 10);
    const bucket = volumeMap.get(key);
    if (!bucket) continue;
    if (r.direction === "inbound") bucket.inbound += 1;
    else bucket.outbound += 1;
  }

  const volumeByDay: DailyVolumePoint[] = dayKeys.map((date) => {
    const v = volumeMap.get(date)!;
    return { date, inbound: v.inbound, outbound: v.outbound };
  });

  const intentCounts = new Map<string, number>();
  for (const row of threadsByIntentRes.data ?? []) {
    const intent = String((row as { last_intent: string }).last_intent);
    intentCounts.set(intent, (intentCounts.get(intent) ?? 0) + 1);
  }
  const intentBreakdown: IntentBreakdownPoint[] = [...intentCounts.entries()]
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count);

  const statusCounts = new Map<string, number>();
  for (const row of threadsByStatusRes.data ?? []) {
    const status = String((row as { status: string }).status);
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }
  const threadStatusBreakdown: ThreadStatusPoint[] = [...statusCounts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  return {
    metrics: {
      emailsReceived,
      inSystemEmails,
      newEmails,
      queriesResolved,
      avgRating,
    },
    volumeByDay,
    intentBreakdown,
    threadStatusBreakdown,
  };
}
