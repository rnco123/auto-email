import { IssueCheckChat } from "@/components/chat/issue-check-chat";

export default function ChatDevPage() {
  return (
    <IssueCheckChat
      apiPath="/api/dashboard/chat-turn"
      variant="dashboard"
      title="Chat-Dev"
      description="Open-access pipeline testing (OpenAI + Supabase). Messages are not sent via Resend. Requires DISABLE_PATIENT_VERIFICATION=true."
    />
  );
}
