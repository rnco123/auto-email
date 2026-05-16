import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getThread,
  getThreadMessages,
} from "@/lib/supabase/email-store";
import { RefreshButton } from "../../refresh-button";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function maskDobInText(text: string | null): string {
  if (!text) return "";
  return text.replace(
    /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})\b/g,
    "[DOB redacted]"
  );
}

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let thread;
  let messages;
  let error: string | null = null;

  try {
    thread = await getThread(id);
    if (!thread) notFound();
    messages = await getThreadMessages(id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load thread";
    return (
      <div>
        <Link href="/" className="back-link">
          ← All threads
        </Link>
        <p style={{ color: "var(--danger)" }}>{error}</p>
      </div>
    );
  }

  return (
    <>
      <Link href="/" className="back-link">
        ← All threads
      </Link>
      <div className="page-title-row">
        <h2 style={{ marginTop: 0 }}>{thread.patient_email}</h2>
        <RefreshButton />
      </div>
      <p className="muted">
        {thread.subject ?? "(no subject)"} ·{" "}
        <span className={`badge ${thread.status}`}>{thread.status}</span>
        {thread.last_intent && <> · {thread.last_intent}</>}
      </p>

      <div className="messages">
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.direction}`}>
            <div className="message-meta">
              {m.direction === "inbound" ? "Patient" : "Clinic"} ·{" "}
              {formatDate(m.created_at)}
            </div>
            {maskDobInText(m.body_text)}
          </div>
        ))}
      </div>

      {messages.length === 0 && (
        <p className="muted">No messages in this thread.</p>
      )}
    </>
  );
}
