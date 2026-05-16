import { getSupabaseAdmin } from "./client";
import type {
  EmailIntent,
  EmailMessage,
  EmailThread,
  InboundEmailPayload,
  ThreadStatus,
} from "@/lib/types";

export async function findThreadByMessageRef(
  messageId?: string,
  inReplyTo?: string
): Promise<EmailThread | null> {
  const supabase = getSupabaseAdmin();

  if (inReplyTo) {
    const { data } = await supabase
      .from("email_threads")
      .select("*")
      .eq("message_id_root", inReplyTo)
      .maybeSingle();
    if (data) return data as EmailThread;
  }

  if (messageId) {
    const { data } = await supabase
      .from("email_threads")
      .select("*")
      .eq("message_id_root", messageId)
      .maybeSingle();
    if (data) return data as EmailThread;
  }

  return null;
}

export async function findThreadByEmailSubject(
  patientEmail: string,
  subject: string
): Promise<EmailThread | null> {
  const supabase = getSupabaseAdmin();
  const normalizedSubject = subject.replace(/^(re:\s*)+/i, "").trim();

  const { data } = await supabase
    .from("email_threads")
    .select("*")
    .eq("patient_email", patientEmail.toLowerCase())
    .ilike("subject", `%${normalizedSubject}%`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as EmailThread) ?? null;
}

export async function getOrCreateThread(
  payload: InboundEmailPayload
): Promise<EmailThread> {
  const supabase = getSupabaseAdmin();
  const patientEmail = extractEmailAddress(payload.from).toLowerCase();

  let thread =
    (await findThreadByMessageRef(payload.messageId, payload.inReplyTo)) ??
    (await findThreadByEmailSubject(patientEmail, payload.subject));

  if (thread) return thread;

  const rootId = payload.inReplyTo ?? payload.messageId ?? null;

  const { data, error } = await supabase
    .from("email_threads")
    .insert({
      patient_email: patientEmail,
      subject: payload.subject,
      status: "active",
      message_id_root: rootId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as EmailThread;
}

export async function messageExists(resendEmailId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("email_messages")
    .select("id")
    .eq("resend_email_id", resendEmailId)
    .maybeSingle();
  return !!data;
}

export async function logInboundMessage(
  threadId: string,
  payload: InboundEmailPayload
): Promise<EmailMessage> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("email_messages")
    .insert({
      thread_id: threadId,
      direction: "inbound",
      resend_email_id: payload.emailId,
      body_text: payload.text,
      raw_metadata: {
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        messageId: payload.messageId,
        inReplyTo: payload.inReplyTo,
      },
    })
    .select()
    .single();

  if (error) throw error;
  return data as EmailMessage;
}

export async function logOutboundMessage(
  threadId: string,
  bodyText: string,
  resendEmailId?: string
): Promise<EmailMessage> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("email_messages")
    .insert({
      thread_id: threadId,
      direction: "outbound",
      resend_email_id: resendEmailId ?? null,
      body_text: bodyText,
    })
    .select()
    .single();

  if (error) throw error;
  return data as EmailMessage;
}

export async function updateThread(
  threadId: string,
  updates: Partial<{
    status: ThreadStatus;
    last_intent: EmailIntent;
    verified_patient_id: string | null;
    message_id_root: string | null;
  }>
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("email_threads")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", threadId);
  if (error) throw error;
}

export async function listThreads(limit = 50): Promise<EmailThread[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_threads")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EmailThread[];
}

export async function getThread(id: string): Promise<EmailThread | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_threads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as EmailThread) ?? null;
}

export async function getThreadMessages(
  threadId: string
): Promise<EmailMessage[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EmailMessage[];
}

export async function enqueueJob(threadId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_processing_jobs")
    .insert({ thread_id: threadId, status: "pending" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function claimPendingJobs(limit = 10): Promise<
  { id: string; thread_id: string }[]
> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_processing_jobs")
    .select("id, thread_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const jobs = data ?? [];
  for (const job of jobs) {
    await supabase
      .from("email_processing_jobs")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", job.id);
  }
  return jobs;
}

export async function completeJob(
  jobId: string,
  status: "completed" | "failed",
  errorMessage?: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("email_processing_jobs")
    .update({
      status,
      error: errorMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}
