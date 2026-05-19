import { NextResponse } from "next/server";
import { isDashboardAuthenticated } from "@/lib/auth/dashboard-auth";
import { getDashboardStats } from "@/lib/supabase/dashboard-stats";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isDashboardAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
