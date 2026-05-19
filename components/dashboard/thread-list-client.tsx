"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ThreadListItem } from "@/lib/supabase/email-store";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function ThreadListClient({ threads }: { threads: ThreadListItem[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.patient_email.toLowerCase().includes(q) ||
        (t.subject ?? "").toLowerCase().includes(q) ||
        (t.last_intent ?? "").toLowerCase().includes(q)
      );
    });
  }, [threads, query, statusFilter]);

  const statuses = useMemo(() => {
    const set = new Set(threads.map((t) => t.status));
    return ["all", ...set];
  }, [threads]);

  return (
    <div className="mailbox">
      <div className="mailbox-toolbar">
        <input
          type="search"
          placeholder="Search threads…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mailbox-search"
          aria-label="Search threads"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="mailbox-filter"
          aria-label="Filter by status"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        <span className="muted mailbox-count">
          {filtered.length} of {threads.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="muted">No threads match your filters.</p>
      ) : (
        <ul className="thread-list">
          {filtered.map((t) => {
            const unread =
              t.last_direction === "inbound" && t.message_count > 0;
            return (
              <li key={t.id}>
                <Link href={`/threads/${t.id}`} className="thread-row">
                  <div className="thread-row-main">
                    {unread && (
                      <span className="thread-unread" aria-label="Unread" />
                    )}
                    <span className="thread-email">{t.patient_email}</span>
                    <span className="thread-subject">
                      {t.subject ?? "(no subject)"}
                    </span>
                  </div>
                  <div className="thread-row-meta">
                    <span className={`badge ${t.status}`}>{t.status}</span>
                    {t.last_intent && (
                      <span className="thread-intent">{t.last_intent}</span>
                    )}
                    <span className="thread-date">
                      {formatDate(t.last_message_at ?? t.updated_at)}
                    </span>
                    <span className="thread-msg-count">
                      {t.message_count} msg
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
