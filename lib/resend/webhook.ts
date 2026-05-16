import { Webhook } from "svix";

export interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
  };
}

export function verifyResendWebhook(
  payload: string,
  headers: {
    "svix-id"?: string | null;
    "svix-timestamp"?: string | null;
    "svix-signature"?: string | null;
  }
): ResendWebhookEvent {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) throw new Error("RESEND_WEBHOOK_SECRET is required");

  const wh = new Webhook(secret);
  return wh.verify(payload, {
    "svix-id": headers["svix-id"] ?? "",
    "svix-timestamp": headers["svix-timestamp"] ?? "",
    "svix-signature": headers["svix-signature"] ?? "",
  }) as ResendWebhookEvent;
}
