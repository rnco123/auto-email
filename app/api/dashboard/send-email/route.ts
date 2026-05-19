import { NextResponse } from "next/server";
import { z } from "zod";
import { isDashboardAuthenticated } from "@/lib/auth/dashboard-auth";
import {
  getLastInboundMessageId,
  getThread,
  logOutboundMessage,
  updateThread,
} from "@/lib/supabase/email-store";
import { sendReply } from "@/lib/resend/client";

export const runtime = "nodejs";

const bodySchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().min(1).max(50_000),
  subject: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  if (!(await isDashboardAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { threadId, body, subject } = parsed.data;
    const thread = await getThread(threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const inReplyTo = await getLastInboundMessageId(threadId);
    const emailSubject = subject ?? thread.subject ?? "Your clinic message";

    const { id: resendId } = await sendReply({
      to: thread.patient_email,
      subject: emailSubject,
      text: body,
      inReplyTo: inReplyTo ?? undefined,
      references: inReplyTo ?? undefined,
    });

    await logOutboundMessage(threadId, body, resendId);
    await updateThread(threadId, {});

    return NextResponse.json({ ok: true, resendId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
