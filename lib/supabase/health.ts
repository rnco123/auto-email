import { getSupabaseAdmin } from "./client";

export type SupabaseHealthLog = {
  level: "info" | "error";
  message: string;
  at: string;
};

export type SupabaseHealthResult = {
  connected: boolean;
  url: string | null;
  threadCount: number;
  messageCount: number;
  logs: SupabaseHealthLog[];
  error?: string;
};

function log(
  logs: SupabaseHealthLog[],
  level: SupabaseHealthLog["level"],
  message: string
): void {
  const entry = { level, message, at: new Date().toISOString() };
  logs.push(entry);
  const prefix = level === "error" ? "[supabase] ERROR" : "[supabase]";
  console.log(`${prefix} ${message}`);
}

export async function checkSupabaseConnection(): Promise<SupabaseHealthResult> {
  const logs: SupabaseHealthLog[] = [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;

  log(logs, "info", "Checking Supabase connection…");

  if (!url || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const msg =
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
    log(logs, "error", msg);
    return {
      connected: false,
      url,
      threadCount: 0,
      messageCount: 0,
      logs,
      error: msg,
    };
  }

  log(logs, "info", `Project URL: ${url}`);

  try {
    const supabase = getSupabaseAdmin();

    const threads = await supabase
      .from("email_threads")
      .select("id", { count: "exact", head: true });

    if (threads.error) {
      log(logs, "error", `email_threads: ${threads.error.message}`);
      return {
        connected: false,
        url,
        threadCount: 0,
        messageCount: 0,
        logs,
        error: threads.error.message,
      };
    }

    const threadCount = threads.count ?? 0;
    log(logs, "info", `email_threads OK (${threadCount} rows)`);

    const messages = await supabase
      .from("email_messages")
      .select("id", { count: "exact", head: true });

    if (messages.error) {
      log(logs, "error", `email_messages: ${messages.error.message}`);
      return {
        connected: false,
        url,
        threadCount,
        messageCount: 0,
        logs,
        error: messages.error.message,
      };
    }

    const messageCount = messages.count ?? 0;
    log(logs, "info", `email_messages OK (${messageCount} rows)`);
    log(logs, "info", "Connected successfully");

    return {
      connected: true,
      url,
      threadCount,
      messageCount,
      logs,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Connection failed";
    log(logs, "error", msg);
    return {
      connected: false,
      url,
      threadCount: 0,
      messageCount: 0,
      logs,
      error: msg,
    };
  }
}
