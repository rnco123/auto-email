import {
  enqueueJob,
  getOrCreateThread,
  logInboundMessage,
  messageExists,
} from "@/lib/supabase/email-store";
import { sendAcknowledgmentReply } from "./ack-reply";
import { processInboundEmail } from "./processor";
import type { InboundEmailPayload } from "@/lib/types";

export async function handleInboundEmail(
  payload: InboundEmailPayload,
  options?: { asyncQueue?: boolean }
): Promise<{ threadId: string; queued: boolean }> {
  if (await messageExists(payload.emailId)) {
    const thread = await getOrCreateThread(payload);
    return { threadId: thread.id, queued: false };
  }

  const thread = await getOrCreateThread(payload);
  await logInboundMessage(thread.id, payload);
  await sendAcknowledgmentReply(payload, thread);

  if (options?.asyncQueue) {
    await enqueueJob(thread.id);
    return { threadId: thread.id, queued: true };
  }

  await processInboundEmail(payload, thread);
  return { threadId: thread.id, queued: false };
}
