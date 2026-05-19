import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Dev-only feedback (no DB) when ENABLE_DEV_CHAT=true */
export async function POST(req: Request) {
  if (process.env.ENABLE_DEV_CHAT !== "true") {
    return NextResponse.json({ error: "Not enabled" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const stage = body.stage as string;

    if (stage === "resolution") {
      const confirmed = body.confirmed === true;
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
      return NextResponse.json({ ok: true, nextStage: "complete" });
    }

    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
