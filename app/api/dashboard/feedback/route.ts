import { NextResponse } from "next/server";
import { isDashboardAuthenticated } from "@/lib/auth/dashboard-auth";
import { toErrorMessage } from "@/lib/supabase/errors";
import {
  saveChatSessionResolution,
  saveThreadRating,
  saveThreadResolution,
} from "@/lib/supabase/thread-feedback";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isDashboardAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const stage = body.stage as string;
    const sessionKey =
      typeof body.sessionKey === "string" ? body.sessionKey.trim() : "";
    const threadId =
      typeof body.threadId === "string" ? body.threadId.trim() : "";

    if (stage === "resolution") {
      const confirmed = body.confirmed === true;
      if (threadId) {
        await saveThreadResolution(threadId, confirmed);
      } else if (sessionKey) {
        await saveChatSessionResolution(sessionKey, confirmed);
      } else {
        return NextResponse.json(
          { error: "threadId or sessionKey required" },
          { status: 400 }
        );
      }
      return NextResponse.json({
        ok: true,
        nextStage: confirmed ? "rating" : "complete",
      });
    }

    if (stage === "rating") {
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: "rating must be 1–5" },
          { status: 400 }
        );
      }
      const comment =
        typeof body.comment === "string" ? body.comment.trim() : null;

      if (threadId) {
        await saveThreadRating({
          threadId,
          rating,
          comment,
          resolutionConfirmed: true,
        });
      } else if (sessionKey) {
        await saveThreadRating({
          sessionKey,
          rating,
          comment,
          resolutionConfirmed: true,
        });
      } else {
        return NextResponse.json(
          { error: "threadId or sessionKey required" },
          { status: 400 }
        );
      }
      return NextResponse.json({ ok: true, nextStage: "complete" });
    }

    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  } catch (e) {
    const message = toErrorMessage(e, "Failed to save feedback", {
      table: "thread_ratings",
      migration: "RUN_PENDING.sql",
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
