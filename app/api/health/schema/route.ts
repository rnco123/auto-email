import { NextResponse } from "next/server";
import { checkSchemaHealth } from "@/lib/supabase/schema-health";

export const runtime = "nodejs";

export async function GET() {
  try {
    const schema = await checkSchemaHealth();
    return NextResponse.json(schema);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Schema check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
