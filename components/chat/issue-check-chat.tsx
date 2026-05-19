"use client";

import { useCallback, useId, useState } from "react";
import type { ApiResult, PdfAttachment, Turn, TurnDebug } from "@/app/dev/chat/chat-types";
import { formatChatForCopy } from "@/app/dev/chat/format-chat-copy";
import { feedbackUiLabels } from "@/lib/feedback/prompts";
import type { PatientLanguage } from "@/lib/types";
import "@/app/dev/chat/dev-chat.css";

type FeedbackStage = "resolution" | "rating" | null;

const QUICK_MESSAGES = [
  { label: "SOAP request", text: "I need my SOAP note from my last visit." },
  {
    label: "SOAP (ES)",
    text: "Necesito mi nota SOAP de mi última visita. Nombre: Aleeza Hussain. Fecha de nacimiento: 2026-03-01.",
  },
  {
    label: "Name + DOB (Aleeza)",
    text: "Name: Aleeza Hussain\nDOB: 2026-03-01",
  },
  { label: "Locations", text: "What are your clinic locations?" },
  { label: "Ubicaciones", text: "¿Cuáles son las ubicaciones de la clínica?" },
  { label: "Services", text: "What services do you offer?" },
  { label: "Servicios", text: "¿Qué servicios ofrecen?" },
  { label: "Hello", text: "Hello" },
  { label: "Hola", text: "Hola" },
  { label: "Any update?", text: "any update?" },
  { label: "¿Alguna novedad?", text: "¿alguna novedad?" },
];

function factLabel(key: string): { label: string; tone: "ok" | "warn" | "neutral" } {
  if (key === "soapNotePdfAttached")
    return { label: "SOAP PDF generated", tone: "ok" };
  if (key === "soapPatientNotFound") return { label: "Patient not found", tone: "warn" };
  if (key === "needsPatientForSoap") return { label: "Needs name/DOB", tone: "warn" };
  if (key === "noSoapOnFile") return { label: "No SOAP on file", tone: "warn" };
  if (key === "clinicDataUnavailable") return { label: "DB unavailable", tone: "warn" };
  return { label: key, tone: "neutral" };
}

type IssueCheckChatProps = {
  apiPath: string;
  feedbackApiPath?: string;
  variant?: "standalone" | "dashboard";
  title?: string;
  description?: string;
};

export function IssueCheckChat({
  apiPath,
  feedbackApiPath = "/api/dashboard/feedback",
  variant = "dashboard",
  title = "Issue check chat",
  description = "Same AI pipeline as inbound email (OpenAI + Supabase). No Resend. Press Ctrl+Enter to send. Use Copy chat when reporting issues.",
}: IssueCheckChatProps) {
  const [input, setInput] = useState(
    "I need my SOAP note from my last visit."
  );
  const [lastIntent, setLastIntent] = useState<string>("");
  const [verifiedPatientId, setVerifiedPatientId] = useState<string | null>(
    null
  );
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [turnHistory, setTurnHistory] = useState<TurnDebug[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ApiResult | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const sessionKey = useId().replace(/:/g, "");
  const [feedbackStage, setFeedbackStage] = useState<FeedbackStage>(null);
  const [feedbackLang, setFeedbackLang] = useState<PatientLanguage>("en");
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  const submitFeedback = useCallback(
    async (payload: {
      stage: "resolution" | "rating";
      confirmed?: boolean;
      rating?: number;
    }) => {
      setFeedbackBusy(true);
      try {
        const res = await fetch(feedbackApiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey, ...payload }),
        });
        const data = (await res.json()) as {
          error?: string;
          nextStage?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Feedback failed");

        if (payload.stage === "resolution") {
          if (payload.confirmed) {
            setFeedbackStage("rating");
          } else {
            setFeedbackStage(null);
            setTranscript((prev) => [
              ...prev,
              {
                role: "clinic",
                text:
                  feedbackLang === "es"
                    ? "Entendido. Cuéntenos en qué más podemos ayudarle."
                    : "Understood. Please let us know what else we can help with.",
              },
            ]);
          }
          return;
        }

        if (payload.stage === "rating" && payload.rating) {
          setFeedbackStage(null);
          setTranscript((prev) => [
            ...prev,
            {
              role: "clinic",
              text:
                feedbackLang === "es"
                  ? `Gracias por su calificación (${payload.rating}/5).`
                  : `Thank you for your rating (${payload.rating}/5).`,
            },
          ]);
        }
      } catch (e) {
        setLastResult({
          error: e instanceof Error ? e.message : "Feedback failed",
        });
      } finally {
        setFeedbackBusy(false);
      }
    },
    [sessionKey, feedbackLang, feedbackApiPath]
  );

  const send = useCallback(async () => {
    const patientMessage = input.trim();
    if (!patientMessage) return;

    setLoading(true);

    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          patientMessage,
          lastIntent: lastIntent || null,
          verifiedPatientId,
        }),
      });

      const data = (await res.json()) as ApiResult;
      setLastResult(data);

      if (!res.ok) return;

      const reply = data.replyText ?? "";
      const attachment =
        data.attachment?.filename && data.attachment?.base64
          ? data.attachment
          : undefined;
      setTranscript((prev) => [
        ...prev,
        { role: "patient", text: patientMessage },
        { role: "clinic", text: reply, attachment },
      ]);
      setTurnHistory((prev) => [...prev, { patientMessage, result: data }]);
      setInput("");
      if (data.intent) setLastIntent(data.intent);
      if (data.patientId) setVerifiedPatientId(data.patientId);
      if (data.feedbackPrompt) {
        setFeedbackStage(data.feedbackPrompt.stage);
        setFeedbackLang(data.feedbackPrompt.language);
      } else {
        setFeedbackStage(null);
      }
    } catch (e) {
      setLastResult({
        error: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setLoading(false);
    }
  }, [apiPath, input, transcript, lastIntent, verifiedPatientId]);

  const copyChat = useCallback(async () => {
    const text = formatChatForCopy(transcript, turnHistory, {
      lastIntent,
      verifiedPatientId,
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 2500);
    }
  }, [transcript, turnHistory, lastIntent, verifiedPatientId]);

  const reset = () => {
    setTranscript([]);
    setTurnHistory([]);
    setLastIntent("");
    setVerifiedPatientId(null);
    setLastResult(null);
    setCopyStatus("idle");
    setFeedbackStage(null);
    setInput("I need my SOAP note from my last visit.");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void send();
    }
  };

  const copyLabel =
    copyStatus === "copied"
      ? "Copied!"
      : copyStatus === "failed"
        ? "Copy failed"
        : "Copy chat";

  const pageClass =
    variant === "standalone"
      ? "dev-chat-page"
      : "dev-chat-page dev-chat-page--dashboard";

  return (
    <div className={pageClass}>
      <header className="dev-chat-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>

      <div className="dev-chat-grid">
        <div className="dev-chat-panel">
          <div className="dev-chat-panel-title-row">
            <h2 className="dev-chat-panel-title">Conversation</h2>
            <button
              type="button"
              className="dev-chat-btn-secondary dev-chat-btn-compact"
              onClick={() => void copyChat()}
              disabled={transcript.length === 0}
              title="Copy conversation and API debug info to clipboard"
            >
              {copyLabel}
            </button>
          </div>
          <div className="dev-chat-thread">
            {transcript.length === 0 ? (
              <p className="dev-chat-empty">
                No messages yet. Send a patient message below.
              </p>
            ) : (
              transcript.map((t, i) => (
                <TurnBubble
                  key={i}
                  role={t.role}
                  text={t.text}
                  attachment={t.attachment}
                />
              ))
            )}
          </div>

          {feedbackStage && (
            <FeedbackPanel
              stage={feedbackStage}
              lang={feedbackLang}
              busy={feedbackBusy}
              onResolution={(confirmed) =>
                void submitFeedback({ stage: "resolution", confirmed })
              }
              onRating={(rating) =>
                void submitFeedback({ stage: "rating", rating })
              }
            />
          )}

          <div className="dev-chat-compose">
            <div className="dev-chat-quick">
              {QUICK_MESSAGES.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setInput(q.text)}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <label htmlFor="patient-input">Patient message</label>
            <textarea
              id="patient-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type as the patient…"
              disabled={loading}
            />
            <div className="dev-chat-actions">
              <button
                type="button"
                className="dev-chat-btn-primary"
                onClick={() => void send()}
                disabled={loading || !input.trim()}
              >
                {loading ? "Thinking…" : "Send"}
              </button>
              <button
                type="button"
                className="dev-chat-btn-secondary"
                onClick={() => void copyChat()}
                disabled={transcript.length === 0}
              >
                {copyLabel}
              </button>
              <button
                type="button"
                className="dev-chat-btn-secondary"
                onClick={reset}
                disabled={loading}
              >
                New thread
              </button>
            </div>
          </div>
        </div>

        <aside className="dev-chat-inspector dev-chat-panel">
          <h2 className="dev-chat-panel-title">Last API result</h2>
          {loading && (
            <p className="dev-chat-loading">Calling analyze + reply…</p>
          )}
          {!loading && !lastResult && (
            <p className="dev-chat-inspector-empty">
              Send a message to see intent, facts, and the clinic reply here.
            </p>
          )}
          {!loading && lastResult && (
            <Inspector
              result={lastResult}
              lastIntent={lastIntent}
              verifiedPatientId={verifiedPatientId}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function TurnBubble({
  role,
  text,
  attachment,
}: {
  role: "patient" | "clinic";
  text: string;
  attachment?: PdfAttachment;
}) {
  const isPatient = role === "patient";
  return (
    <div
      className={
        isPatient
          ? "dev-chat-bubble dev-chat-bubble-patient"
          : "dev-chat-bubble dev-chat-bubble-clinic"
      }
    >
      <div className="dev-chat-bubble-label">
        {isPatient ? "Patient" : "Clinic"}
      </div>
      <div className="dev-chat-bubble-body">{text}</div>
      {attachment && <PdfDownload attachment={attachment} />}
    </div>
  );
}

function PdfDownload({ attachment }: { attachment: PdfAttachment }) {
  const href = `data:application/pdf;base64,${attachment.base64}`;
  return (
    <div className="dev-chat-attachment">
      <div className="dev-chat-attachment-label">SOAP note PDF</div>
      <a
        className="dev-chat-download-btn"
        href={href}
        download={attachment.filename}
      >
        Download {attachment.filename}
      </a>
    </div>
  );
}

function Inspector({
  result,
  lastIntent,
  verifiedPatientId,
}: {
  result: ApiResult;
  lastIntent: string;
  verifiedPatientId: string | null;
}) {
  if (result.error) {
    return (
      <div className="dev-chat-error">
        <strong>Error</strong>
        <p style={{ margin: "0.5rem 0 0" }}>{result.error}</p>
        {result.fix && <p style={{ margin: "0.5rem 0 0" }}>{result.fix}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="dev-chat-meta">
        <div className="dev-chat-badges">
          {result.intent && (
            <span className="dev-chat-badge dev-chat-badge-intent">
              intent: {result.intent}
            </span>
          )}
          {result.effectiveIntent && result.effectiveIntent !== result.intent && (
            <span className="dev-chat-badge dev-chat-badge-intent">
              AI action: {result.effectiveIntent}
            </span>
          )}
          {result.systemActions && result.systemActions.length > 0 && (
            <span className="dev-chat-badge">
              system: {result.systemActions.join(", ")}
            </span>
          )}
          {result.replyLanguage && (
            <span className="dev-chat-badge">
              lang: {result.replyLanguage}
            </span>
          )}
          {result.isPolicyQuestion && (
            <span className="dev-chat-badge">policy question</span>
          )}
          {result.replyStrategy && (
            <span
              className="dev-chat-badge"
              title={result.replyStrategy}
              style={{ maxWidth: "100%" }}
            >
              strategy: {result.replyStrategy.slice(0, 48)}
              {result.replyStrategy.length > 48 ? "…" : ""}
            </span>
          )}
          {result.confidence != null && (
            <span className="dev-chat-badge">
              confidence: {Math.round(result.confidence * 100)}%
            </span>
          )}
          {lastIntent && result.intent && lastIntent !== result.intent && (
            <span className="dev-chat-badge">
              thread lastIntent: {lastIntent}
            </span>
          )}
          {verifiedPatientId && (
            <span className="dev-chat-badge dev-chat-badge-ok">
              patient: {verifiedPatientId}
              {result.patientName ? ` (${result.patientName})` : ""}
            </span>
          )}
          {result.identityHints?.name && (
            <span className="dev-chat-badge">
              identity: {result.identityHints.name}
              {result.identityHints.dob
                ? ` · DOB ${result.identityHints.dob}`
                : ""}
            </span>
          )}
        </div>
        {result.factsKeys && result.factsKeys.length > 0 && (
          <ul className="dev-chat-facts">
            <li>
              <strong>Facts returned</strong>
            </li>
            {result.factsKeys.map((key) => {
              const { label, tone } = factLabel(key);
              return (
                <li key={key}>
                  <span
                    className={`dev-chat-badge ${
                      tone === "ok"
                        ? "dev-chat-badge-ok"
                        : tone === "warn"
                          ? "dev-chat-badge-warn"
                          : ""
                    }`}
                    style={{ display: "inline-block", marginTop: 4 }}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {result.replyText && (
        <div className="dev-chat-reply-box">
          <h3>Clinic reply (this turn)</h3>
          <p className="dev-chat-reply-text">{result.replyText}</p>
        </div>
      )}
      {result.attachment?.base64 && result.attachment.filename && (
        <div style={{ margin: "0 1rem 1rem" }}>
          <PdfDownload attachment={result.attachment} />
        </div>
      )}
    </>
  );
}

function FeedbackPanel({
  stage,
  lang,
  busy,
  onResolution,
  onRating,
}: {
  stage: "resolution" | "rating";
  lang: PatientLanguage;
  busy: boolean;
  onResolution: (confirmed: boolean) => void;
  onRating: (rating: number) => void;
}) {
  if (stage === "resolution") {
    const labels = feedbackUiLabels(lang, "resolution");
    return (
      <div className="feedback-panel" role="group" aria-label={labels.question}>
        <p className="feedback-panel-question">{labels.question}</p>
        <div className="feedback-panel-actions">
          <button
            type="button"
            className="dev-chat-btn-primary"
            disabled={busy}
            onClick={() => onResolution(true)}
          >
            {labels.yes}
          </button>
          <button
            type="button"
            className="dev-chat-btn-secondary"
            disabled={busy}
            onClick={() => onResolution(false)}
          >
            {labels.no}
          </button>
        </div>
      </div>
    );
  }

  const labels = feedbackUiLabels(lang, "rating");
  const stars: readonly number[] = [1, 2, 3, 4, 5];
  return (
    <div className="feedback-panel" role="group" aria-label={labels.question}>
      <p className="feedback-panel-question">{labels.question}</p>
      <div className="feedback-stars">
        {stars.map((n) => (
          <button
            key={n}
            type="button"
            className="feedback-star-btn"
            disabled={busy}
            onClick={() => onRating(n)}
            aria-label={`${n} stars`}
          >
            {n}★
          </button>
        ))}
      </div>
    </div>
  );
}
