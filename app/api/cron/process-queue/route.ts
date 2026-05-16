import { NextRequest, NextResponse } from "next/server";
import { processThreadById } from "@/lib/email/processor";
import {
  claimPendingJobs,
  completeJob,
} from "@/lib/supabase/email-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await claimPendingJobs(10);
  const results: { jobId: string; ok: boolean; error?: string }[] = [];

  for (const job of jobs) {
    try {
      await processThreadById(job.thread_id);
      await completeJob(job.id, "completed");
      results.push({ jobId: job.id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await completeJob(job.id, "failed", message);
      results.push({ jobId: job.id, ok: false, error: message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
