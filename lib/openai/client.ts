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

export const CLASSIFY_MODEL = "gpt-4.1-mini";
export const REPLY_MODEL = "gpt-4.1-mini";
