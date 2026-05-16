import { sendReply } from "@/lib/resend/client";
import { logOutboundMessage } from "@/lib/supabase/email-store";
import type { EmailThread, InboundEmailPayload } from "@/lib/types";

export const ACKNOWLEDGMENT_REPLY = `hello,

YOur query have been recieved will be answer soon.

Thank you!`;

export async function sendAcknowledgmentReply(
  payload: InboundEmailPayload,
  thread: EmailThread
): Promise<void> {
  const to = extractEmail(payload.from);
  const subject = payload.subject.replace(/^(re:\s*)+/i, "");

  const sent = await sendReply({
    to,
    subject,
    text: ACKNOWLEDGMENT_REPLY,
    inReplyTo: payload.messageId,
    references: payload.references ?? payload.messageId,
  });

  await logOutboundMessage(thread.id, ACKNOWLEDGMENT_REPLY, sent.id);
}

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}
