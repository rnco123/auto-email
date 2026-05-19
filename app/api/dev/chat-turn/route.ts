import { NextResponse } from "next/server";
import { handleChatTurn } from "@/lib/chat/handle-chat-turn";

export const runtime = "nodejs";

function devChatDisabled() {
  return process.env.ENABLE_DEV_CHAT !== "true";
}

export async function GET() {
  if (devChatDisabled()) {
    return NextResponse.json(
      {
        error: "Dev chat is disabled",
        fix: "Set ENABLE_DEV_CHAT=true in .env, or use /chat in the dashboard after login",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Use POST with JSON body, or open /dev/chat or /chat in the dashboard.",
  });
}

export async function POST(req: Request) {
  if (devChatDisabled()) {
    return NextResponse.json(
      {
        error: "Not enabled",
        fix: "Set ENABLE_DEV_CHAT=true in .env, or use /chat in the dashboard after login",
      },
      { status: 404 }
    );
  }

  try {
    const body = await req.json();
    const result = await handleChatTurn(body);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
