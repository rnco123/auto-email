import Link from "next/link";
import { listRecentMessages, listThreads } from "@/lib/supabase/email-store";
import { checkSupabaseConnection } from "@/lib/supabase/health";
import { seedSampleLogsIfEmpty } from "@/lib/supabase/seed-sample";
import { RefreshButton } from "./refresh-button";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatLogTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function previewText(text: string | null, max = 120): string {
  if (!text) return "—";
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

export default async function ThreadsPage() {
  let threads: Awaited<ReturnType<typeof listThreads>> = [];
  let messages: Awaited<ReturnType<typeof listRecentMessages>> = [];
  let error: string | null = null;
  let seedNote: string | null = null;

  const health = await checkSupabaseConnection();

  if (health.connected && process.env.SEED_SAMPLE_LOGS === "true") {
    try {
      const seed = await seedSampleLogsIfEmpty();
      if (seed.seeded) seedNote = seed.message;
    } catch (e) {
      seedNote =
        e instanceof Error ? e.message : "Sample seed failed";
    }
  }

  if (health.connected) {
    try {
      [threads, messages] = await Promise.all([
        listThreads(),
        listRecentMessages(),
      ]);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load threads";
    }
  } else {
    error = health.error ?? "Supabase not connected";
  }

  return (
    <>
      <div className="page-title-row">
        <h2 style={{ marginTop: 0 }}>Email threads</h2>
        <RefreshButton />
      </div>
      <p className="muted">
        Inbound and outbound patient email conversations. Clinical data is never
        modified from this app.
      </p>

      <section className="health-panel" aria-label="Supabase connection status">
        <header className="health-panel-header">
          <strong>Supabase</strong>
          <span
            className={`badge ${health.connected ? "verified" : "failed"}`}
          >
            {health.connected ? "connected" : "disconnected"}
          </span>
        </header>
        {health.url && (
          <p className="muted" style={{ margin: "0.25rem 0 0.5rem", fontSize: "0.8125rem" }}>
            {health.url} · {health.threadCount} threads · {health.messageCount}{" "}
            messages
          </p>
        )}
        <ul className="health-logs">
          {health.logs.map((entry, i) => (
            <li
              key={i}
              className={entry.level === "error" ? "health-log-error" : ""}
            >
              <span className="health-log-time">
                {formatLogTime(entry.at)}
              </span>
              {entry.message}
            </li>
          ))}
        </ul>
        {seedNote && (
          <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem" }}>
            {seedNote}
          </p>
        )}
        <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.75rem" }}>
          API:{" "}
          <a href="/api/health/supabase?seed=true">
            /api/health/supabase?seed=true
          </a>{" "}
          · Set <code>SEED_SAMPLE_LOGS=true</code> to auto-seed on load
        </p>
      </section>

      {error && (
        <p style={{ color: "var(--danger)" }}>
          {error}. Check Supabase env vars and run migrations{" "}
          <code>001_email_automation.sql</code> and{" "}
          <code>002_email_rls_policies.sql</code>.
        </p>
      )}

      {!error && threads.length === 0 && (
        <p className="muted">No email threads yet.</p>
      )}

      {threads.length > 0 && (
        <>
          <h3 className="section-heading">Threads</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient email</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Last intent</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {threads.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/threads/${t.id}`}>{t.patient_email}</Link>
                  </td>
                  <td>{t.subject ?? "—"}</td>
                  <td>
                    <span className={`badge ${t.status}`}>{t.status}</span>
                  </td>
                  <td>{t.last_intent ?? "—"}</td>
                  <td>{formatDate(t.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!error && (
        <>
          <h3 className="section-heading">Email messages</h3>
          <p className="muted section-desc">
            All inbound and outbound messages from <code>email_messages</code>{" "}
            in Supabase.
          </p>
          {messages.length === 0 ? (
            <p className="muted">No messages yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Direction</th>
                  <th>Patient</th>
                  <th>Subject</th>
                  <th>Message</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className={`badge ${m.direction}`}>
                        {m.direction}
                      </span>
                    </td>
                    <td>
                      <Link href={`/threads/${m.thread_id}`}>
                        {m.patient_email}
                      </Link>
                    </td>
                    <td>{m.thread_subject ?? "—"}</td>
                    <td className="message-preview">
                      <Link href={`/threads/${m.thread_id}`}>
                        {previewText(m.body_text)}
                      </Link>
                    </td>
                    <td>{formatDate(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}
