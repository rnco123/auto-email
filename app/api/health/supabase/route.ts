import { NextResponse } from "next/server";
import { checkSupabaseConnection } from "@/lib/supabase/health";
import { seedSampleLogsIfEmpty } from "@/lib/supabase/seed-sample";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const seed = searchParams.get("seed") === "true";

  const health = await checkSupabaseConnection();

  let seedResult = null;
  if (seed && health.connected) {
    try {
      seedResult = await seedSampleLogsIfEmpty();
    } catch (e) {
      seedResult = {
        seeded: false,
        message: e instanceof Error ? e.message : "Seed failed",
      };
    }
  }

  return NextResponse.json({ ...health, seed: seedResult });
}
