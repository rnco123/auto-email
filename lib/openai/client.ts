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

/** Best available model — override with OPENAI_MODEL in env */
const PRIMARY_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1";

export const CLASSIFY_MODEL =
  process.env.OPENAI_CLASSIFY_MODEL ?? PRIMARY_MODEL;

export const REPLY_MODEL = process.env.OPENAI_REPLY_MODEL ?? PRIMARY_MODEL;
