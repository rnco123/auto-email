import { NextRequest, NextResponse } from "next/server";
import { handleInboundEmail } from "@/lib/email/handler";
import { fetchReceivedEmail } from "@/lib/resend/client";
import { verifyResendWebhook } from "@/lib/resend/webhook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const headers = {
      "svix-id": request.headers.get("svix-id"),
      "svix-timestamp": request.headers.get("svix-timestamp"),
      "svix-signature": request.headers.get("svix-signature"),
    };

    const event = verifyResendWebhook(payload, headers);

    if (event.type !== "email.received") {
      return NextResponse.json({ received: true, skipped: event.type });
    }

    const emailId = event.data.email_id;
    const inbound = await fetchReceivedEmail(emailId);

    const useQueue = process.env.EMAIL_USE_QUEUE === "true";
    const result = await handleInboundEmail(inbound, { asyncQueue: useQueue });

    return NextResponse.json({
      received: true,
      threadId: result.threadId,
      queued: result.queued,
    });
  } catch (err) {
    console.error("Resend webhook error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook failed" },
      { status: 500 }
    );
  }
}
