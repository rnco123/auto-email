export type PdfAttachment = { filename: string; base64: string };

export type Turn = {
  role: "patient" | "clinic";
  text: string;
  attachment?: PdfAttachment;
};

export type ApiResult = {
  intent?: string;
  effectiveIntent?: string | null;
  systemActions?: string[] | null;
  replyText?: string;
  factsKeys?: string[];
  confidence?: number;
  error?: string;
  fix?: string;
  attachment?: PdfAttachment | null;
  patientId?: string | null;
  patientName?: string | null;
  identityHints?: { name: string | null; dob: string | null } | null;
  replyLanguage?: "en" | "es";
  replyStrategy?: string | null;
  isPolicyQuestion?: boolean;
  issueLikelyResolved?: boolean;
  shouldAskResolutionFeedback?: boolean;
  feedbackPrompt?: {
    stage: "resolution" | "rating";
    language: "en" | "es";
  } | null;
};

export type TurnDebug = {
  patientMessage: string;
  result: ApiResult;
};
