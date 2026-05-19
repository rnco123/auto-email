import Link from "next/link";
import { ThreadListClient } from "@/components/dashboard/thread-list-client";
import { listThreadsWithPreview } from "@/lib/supabase/email-store";
import { checkSupabaseConnection } from "@/lib/supabase/health";
import { seedSampleLogsIfEmpty } from "@/lib/supabase/seed-sample";
import { RefreshButton } from "../refresh-button";

export const dynamic = "force-dynamic";

export default async function ThreadsPage() {
  let threads: Awaited<ReturnType<typeof listThreadsWithPreview>> = [];
  let error: string | null = null;
  let seedNote: string | null = null;

  const health = await checkSupabaseConnection();

  if (health.connected && process.env.SEED_SAMPLE_LOGS === "true") {
    try {
      const seed = await seedSampleLogsIfEmpty();
      if (seed.seeded) seedNote = seed.message;
    } catch (e) {
      seedNote = e instanceof Error ? e.message : "Sample seed failed";
    }
  }

  if (health.connected) {
    try {
      threads = await listThreadsWithPreview(200);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load threads";
    }
  } else {
    error = health.error ?? "Supabase not connected";
  }

  return (
    <>
      <div className="page-title-row">
        <h2 style={{ marginTop: 0 }}>Threads</h2>
        <RefreshButton />
      </div>
      <p className="muted">
        Mailbox view of all patient email conversations. Open a thread to read
        messages and send a reply via Resend.
      </p>

      {error && (
        <p style={{ color: "var(--danger)" }}>
          {error}. Check Supabase env vars and migrations.
        </p>
      )}

      {seedNote && (
        <p className="muted" style={{ fontSize: "0.8125rem" }}>
          {seedNote}
        </p>
      )}

      {!error && threads.length === 0 && (
        <p className="muted">
          No email threads yet.{" "}
          <Link href="/chat">Try Chat-Dev</Link> or send a test inbound
          email.
        </p>
      )}

      {!error && threads.length > 0 && <ThreadListClient threads={threads} />}
    </>
  );
}
