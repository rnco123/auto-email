import { getSupabaseAdmin } from "./client";
import { formatSupabaseError } from "./errors";
import type { EmailThread, PatientLanguage } from "@/lib/types";
import {
  ratingPromptBlock,
  resolutionPromptBlock,
  thanksAfterRating,
} from "@/lib/feedback/prompts";
import {
  parseRatingReply,
  parseResolutionReply,
} from "@/lib/feedback/parse-feedback-reply";

export type ThreadFeedbackStage =
  | "none"
  | "awaiting_resolution"
  | "awaiting_rating"
  | "complete";

export type ThreadRatingRow = {
  id: string;
  thread_id: string | null;
  session_key: string | null;
  rating: number;
  resolution_confirmed: boolean | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export async function updateThreadFeedbackStage(
  threadId: string,
  stage: ThreadFeedbackStage,
  extra?: {
    resolved_at?: string | null;
    resolution_confirmed?: boolean | null;
  }
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("email_threads")
    .update({
      feedback_stage: stage,
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq("id", threadId);
  if (error)
    throw new Error(
      formatSupabaseError(error, {
        table: "email_threads",
        migration: "009_thread_feedback_and_admin_rules.sql",
      })
    );
}

export async function saveThreadResolution(
  threadId: string,
  confirmed: boolean
): Promise<void> {
  const now = new Date().toISOString();
  await updateThreadFeedbackStage(
    threadId,
    confirmed ? "awaiting_rating" : "complete",
    {
      resolution_confirmed: confirmed,
      resolved_at: confirmed ? now : null,
    }
  );
}

function throwRatingsError(e: { message: string; code?: string }): never {
  throw new Error(
    formatSupabaseError(e as import("@supabase/supabase-js").PostgrestError, {
      table: "thread_ratings",
      migration: "008_openai_usage_and_ratings.sql / 009",
    })
  );
}

export async function saveThreadRating(input: {
  threadId?: string | null;
  sessionKey?: string | null;
  rating: number;
  resolutionConfirmed?: boolean | null;
  comment?: string | null;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const row = {
    thread_id: input.threadId ?? null,
    session_key: input.sessionKey ?? null,
    rating: input.rating,
    resolution_confirmed: input.resolutionConfirmed ?? true,
    comment: input.comment ?? null,
    updated_at: now,
  };

  if (input.threadId) {
    // Partial unique indexes on nullable columns break PostgREST upsert onConflict;
    // use explicit update-or-insert instead.
    const { data: existing, error: selErr } = await supabase
      .from("thread_ratings")
      .select("id")
      .eq("thread_id", input.threadId)
      .maybeSingle();
    if (selErr) throwRatingsError(selErr);

    if (existing) {
      const { error } = await supabase
        .from("thread_ratings")
        .update(row)
        .eq("id", existing.id);
      if (error) throwRatingsError(error);
    } else {
      const { error } = await supabase.from("thread_ratings").insert(row);
      if (error) throwRatingsError(error);
    }
    await updateThreadFeedbackStage(input.threadId, "complete", {
      resolved_at: now,
    });
    return;
  }

  if (input.sessionKey) {
    const { data: existing, error: selErr } = await supabase
      .from("thread_ratings")
      .select("id")
      .eq("session_key", input.sessionKey)
      .maybeSingle();
    if (selErr) throwRatingsError(selErr);

    if (existing) {
      const { error } = await supabase
        .from("thread_ratings")
        .update(row)
        .eq("id", existing.id);
      if (error) throwRatingsError(error);
    } else {
      const { error } = await supabase.from("thread_ratings").insert(row);
      if (error) throwRatingsError(error);
    }
  }
}

export async function saveChatSessionResolution(
  sessionKey: string,
  confirmed: boolean
): Promise<void> {
  if (!confirmed) return;
  // Resolution tracked client-side until rating; no DB row until rating submitted.
  void sessionKey;
}

export function appendResolutionPrompt(
  replyText: string,
  lang: PatientLanguage
): string {
  if (replyText.includes("Is your issue resolved?")) return replyText;
  if (replyText.includes("¿Se resolvió su consulta?")) return replyText;
  return replyText + resolutionPromptBlock(lang);
}

export function appendRatingPrompt(
  replyText: string,
  lang: PatientLanguage
): string {
  return replyText + ratingPromptBlock(lang);
}

export function ratingThanksReply(lang: PatientLanguage): string {
  return thanksAfterRating(lang);
}

export type EmailFeedbackTurn =
  | { handled: true; replyText: string; newStage: ThreadFeedbackStage }
  | { handled: false };

export function threadFeedbackStage(
  thread: EmailThread
): ThreadFeedbackStage {
  return (
    (thread as EmailThread & { feedback_stage?: ThreadFeedbackStage })
      .feedback_stage ?? "none"
  );
}

/** Handle inbound email when thread is collecting resolution or rating. */
export async function handleEmailFeedbackTurn(
  thread: EmailThread,
  patientText: string,
  lang: PatientLanguage
): Promise<EmailFeedbackTurn> {
  const stage = threadFeedbackStage(thread);

  if (stage === "awaiting_resolution") {
    const parsed = parseResolutionReply(patientText);
    if (!parsed) return { handled: false };

    await saveThreadResolution(thread.id, parsed.confirmed);
    if (!parsed.confirmed) {
      return {
        handled: true,
        replyText:
          lang === "es"
            ? "Entendido. Cuéntenos en qué más podemos ayudarle.\n\nGracias,"
            : "Understood. Please let us know what else we can help with.\n\nThank you,",
        newStage: "complete",
      };
    }
    return {
      handled: true,
      replyText: ratingPromptBlock(lang).replace(/^\n\n---\n/, ""),
      newStage: "awaiting_rating",
    };
  }

  if (stage === "awaiting_rating") {
    const parsed = parseRatingReply(patientText);
    if (!parsed) return { handled: false };

    await saveThreadRating({
      threadId: thread.id,
      rating: parsed.rating,
      resolutionConfirmed: thread.resolution_confirmed ?? true,
    });
    return {
      handled: true,
      replyText: ratingThanksReply(lang),
      newStage: "complete",
    };
  }

  return { handled: false };
}
