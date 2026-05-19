"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminRule } from "@/lib/types";

export function RulesAdminClient() {
  const [rules, setRules] = useState<AdminRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "",
    sort_order: "100",
    active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/rules");
      const data = (await res.json()) as { rules?: AdminRule[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setRules(data.rules ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      title: "",
      body: "",
      category: "",
      sort_order: "100",
      active: true,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = {
      title: form.title,
      body: form.body,
      category: form.category || null,
      sort_order: Number(form.sort_order) || 0,
      active: form.active,
    };

    try {
      const res = await fetch("/api/dashboard/rules", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const startEdit = (rule: AdminRule) => {
    setEditingId(rule.id);
    setForm({
      title: rule.title,
      body: rule.body,
      category: rule.category ?? "",
      sort_order: String(rule.sort_order),
      active: rule.active,
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/rules?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="rules-admin">
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {loading && <p className="muted">Loading rules…</p>}

      {!loading && rules.length === 0 && !error && (
        <p className="muted">No rules yet. Add one below or run migration 009 to load defaults.</p>
      )}

      {!loading && (
        <ul className="rules-list">
          {rules.map((rule) => (
            <li key={rule.id} className="rules-list-item">
              <div className="rules-list-header">
                <strong>{rule.title}</strong>
                {rule.category && (
                  <span className="dev-chat-badge">{rule.category}</span>
                )}
                {!rule.active && (
                  <span className="dev-chat-badge dev-chat-badge-warn">
                    inactive
                  </span>
                )}
              </div>
              <p className="rules-list-body">{rule.body}</p>
              <div className="rules-list-actions">
                <button
                  type="button"
                  className="dev-chat-btn-secondary dev-chat-btn-compact"
                  onClick={() => startEdit(rule)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="dev-chat-btn-secondary dev-chat-btn-compact"
                  onClick={() => void remove(rule.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="rules-form" onSubmit={(e) => void submit(e)}>
        <h3 className="section-heading">
          {editingId ? "Edit rule" : "Add rule"}
        </h3>
        <label>
          Title
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
        </label>
        <label>
          Summary / body
          <textarea
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={4}
            required
          />
        </label>
        <label>
          Category (optional)
          <input
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
            placeholder="e.g. policy, clinical"
          />
        </label>
        <label>
          Sort order
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) =>
              setForm((f) => ({ ...f, sort_order: e.target.value }))
            }
          />
        </label>
        <label className="rules-checkbox">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) =>
              setForm((f) => ({ ...f, active: e.target.checked }))
            }
          />
          Active (included in AI prompts)
        </label>
        <div className="dev-chat-actions">
          <button type="submit" className="dev-chat-btn-primary">
            {editingId ? "Save changes" : "Add rule"}
          </button>
          {editingId && (
            <button
              type="button"
              className="dev-chat-btn-secondary"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
