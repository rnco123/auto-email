import { formatActiveRulesForPrompt } from "@/lib/supabase/admin-rules";

let cachedBlock: string | null = null;
let cachedAt = 0;
const CACHE_MS = 30_000;

/** Active admin rules for prompts, with short in-memory cache. */
export async function getActiveRulesPromptBlock(): Promise<string> {
  const now = Date.now();
  if (cachedBlock !== null && now - cachedAt < CACHE_MS) {
    return cachedBlock;
  }
  try {
    cachedBlock = await formatActiveRulesForPrompt();
    cachedAt = now;
    return cachedBlock;
  } catch {
    return "";
  }
}

export function invalidateActiveRulesCache(): void {
  cachedBlock = null;
  cachedAt = 0;
}
