import { Resend } from "resend";
import type { InboundEmailPayload } from "@/lib/types";

let resend: Resend | null = null;

export function getResend(): Resend {
  if (!resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is required");
    resend = new Resend(key);
  }
  return resend;
}

interface ReceivedEmailApiResponse {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text?: string | null;
  html?: string | null;
  headers?: Record<string, string>;
  message_id?: string;
}

export async function fetchReceivedEmail(
  emailId: string
): Promise<InboundEmailPayload> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is required");

  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch received email: ${res.status} ${body}`);
  }

  const data = (await res.json()) as ReceivedEmailApiResponse;
  const headers = data.headers ?? {};

  return {
    emailId: data.id,
    from: data.from,
    to: data.to ?? [],
    subject: data.subject ?? "(no subject)",
    text: data.text ?? stripHtml(data.html ?? ""),
    html: data.html ?? undefined,
    messageId: headers["message-id"] ?? data.message_id,
    inReplyTo: headers["in-reply-to"],
    references: headers["references"],
  };
}

export async function sendReply(params: {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string;
}): Promise<{ id: string }> {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is required");

  const headers: Record<string, string> = {};
  if (params.inReplyTo) headers["In-Reply-To"] = params.inReplyTo;
  if (params.references) headers["References"] = params.references;

  const { data, error } = await getResend().emails.send({
    from,
    to: params.to,
    subject: params.subject.startsWith("Re:")
      ? params.subject
      : `Re: ${params.subject}`,
    text: params.text,
    headers: Object.keys(headers).length ? headers : undefined,
  });

  if (error) throw new Error(error.message);
  return { id: data?.id ?? "" };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
