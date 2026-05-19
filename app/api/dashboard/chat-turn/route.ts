import { NextResponse } from "next/server";
import { isDashboardAuthenticated } from "@/lib/auth/dashboard-auth";
import { handleChatTurn } from "@/lib/chat/handle-chat-turn";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isDashboardAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await handleChatTurn(body);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("open-access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
