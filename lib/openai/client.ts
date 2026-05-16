import OpenAI from "openai";

let openai: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is required");
    openai = new OpenAI({ apiKey: key });
  }
  return openai;
}

/** Fast model for JSON intent classification */
export const CLASSIFY_MODEL =
  process.env.OPENAI_CLASSIFY_MODEL ?? "gpt-4.1-mini";

/** Higher-quality model for patient-facing replies */
export const REPLY_MODEL = process.env.OPENAI_REPLY_MODEL ?? "gpt-4.1";
