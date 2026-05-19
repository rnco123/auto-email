import { IssueCheckChat } from "@/components/chat/issue-check-chat";

export default function DevChatPage() {
  return (
    <IssueCheckChat
      apiPath="/api/dev/chat-turn"
      feedbackApiPath="/api/dev/feedback"
      variant="standalone"
      title="Dev chat — local test"
      description="Same automation as email (OpenAI + Supabase). No Resend. Press Ctrl+Enter to send. Use Copy chat when reporting an issue. Requires ENABLE_DEV_CHAT=true."
    />
  );
}
