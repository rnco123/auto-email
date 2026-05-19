"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ThreadComposeProps = {
  threadId: string;
  defaultSubject: string;
  patientEmail: string;
};

export function ThreadCompose({
  threadId,
  defaultSubject,
  patientEmail,
}: ThreadComposeProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;

    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/dashboard/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          body: text,
          subject: subject.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Send failed"
        );
      }
      setBody("");
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="compose-panel" onSubmit={handleSend}>
      <h3 className="compose-title">Reply to patient</h3>
      <p className="muted compose-to">To: {patientEmail}</p>
      <label className="compose-label">
        Subject
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="compose-input"
        />
      </label>
      <label className="compose-label">
        Message
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="compose-textarea"
          placeholder="Write your message to the patient…"
          required
        />
      </label>
      {error && <p className="compose-error">{error}</p>}
      {success && (
        <p className="compose-success">Message sent via Resend.</p>
      )}
      <button type="submit" className="btn-primary" disabled={sending}>
        {sending ? "Sending…" : "Send email"}
      </button>
    </form>
  );
}
