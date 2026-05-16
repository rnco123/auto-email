import { getSupabaseAdmin } from "./client";

const SAMPLE_EMAIL = "sample-check@example.com";
const SAMPLE_INBOUND_ID = "sample-inbound-001";

export type SeedSampleResult = {
  seeded: boolean;
  threadId?: string;
  message: string;
};

export async function seedSampleLogsIfEmpty(): Promise<SeedSampleResult> {
  const supabase = getSupabaseAdmin();

  const { data: existingMsg } = await supabase
    .from("email_messages")
    .select("thread_id")
    .eq("resend_email_id", SAMPLE_INBOUND_ID)
    .maybeSingle();

  if (existingMsg) {
    console.log("[supabase] Sample messages already exist, skipping seed");
    return {
      seeded: false,
      threadId: existingMsg.thread_id as string,
      message: "Sample logs already present",
    };
  }

  const { data: thread, error: threadError } = await supabase
    .from("email_threads")
    .insert({
      patient_email: SAMPLE_EMAIL,
      subject: "[Sample] Appointment question",
      status: "active",
      last_intent: "appointment",
      message_id_root: "sample-msg-root-001",
    })
    .select()
    .single();

  if (threadError) {
    console.error("[supabase] Seed failed:", threadError.message);
    throw new Error(threadError.message);
  }

  const threadId = thread.id as string;

  const { error: msgError } = await supabase.from("email_messages").insert([
    {
      thread_id: threadId,
      direction: "inbound",
      resend_email_id: SAMPLE_INBOUND_ID,
      body_text:
        "Hi, this is a sample inbound message to verify Supabase is connected. When can I come in for my appointment?",
      raw_metadata: { sample: true, from: SAMPLE_EMAIL },
    },
    {
      thread_id: threadId,
      direction: "outbound",
      resend_email_id: null,
      body_text:
        "Sample outbound reply: Please reply with your full name and date of birth so we can look up your next appointment.",
      raw_metadata: { sample: true },
    },
  ]);

  if (msgError) {
    console.error("[supabase] Seed messages failed:", msgError.message);
    throw new Error(msgError.message);
  }

  console.log(
    `[supabase] Seeded sample thread ${threadId} with 2 messages for ${SAMPLE_EMAIL}`
  );

  return {
    seeded: true,
    threadId,
    message: "Created sample thread with inbound + outbound messages",
  };
}
