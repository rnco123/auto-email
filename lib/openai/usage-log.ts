import { getSupabaseAdmin } from "@/lib/supabase/client";
import { estimateCostUsd } from "./pricing";

export type OpenAIOperation = "analyze" | "reply" | "classify" | "other";

export interface OpenAIUsageInput {
  model: string;
  operation: OpenAIOperation;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  threadId?: string | null;
}

export interface UsageFromCompletion {
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
}

export function usageFromCompletion(response: UsageFromCompletion): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  const promptTokens = response.usage?.prompt_tokens ?? 0;
  const completionTokens = response.usage?.completion_tokens ?? 0;
  const totalTokens =
    response.usage?.total_tokens ?? promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

export async function logOpenAIUsage(input: OpenAIUsageInput): Promise<void> {
  const promptTokens = Math.max(0, input.promptTokens);
  const completionTokens = Math.max(0, input.completionTokens);
  const totalTokens =
    input.totalTokens ?? promptTokens + completionTokens;

  if (totalTokens === 0 && promptTokens === 0 && completionTokens === 0) {
    return;
  }

  const estimatedCostUsd = estimateCostUsd(
    input.model,
    promptTokens,
    completionTokens
  );

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("openai_usage_logs").insert({
      model: input.model,
      operation: input.operation,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: estimatedCostUsd,
      thread_id: input.threadId ?? null,
    });
    if (error) {
      console.warn("[openai-usage] failed to persist:", error.message);
    }
  } catch (e) {
    console.warn(
      "[openai-usage] log skipped:",
      e instanceof Error ? e.message : e
    );
  }
}

export async function logOpenAICompletion(
  response: UsageFromCompletion,
  operation: OpenAIOperation,
  model: string,
  threadId?: string | null
): Promise<void> {
  const { promptTokens, completionTokens, totalTokens } =
    usageFromCompletion(response);
  await logOpenAIUsage({
    model: response.model ?? model,
    operation,
    promptTokens,
    completionTokens,
    totalTokens,
    threadId,
  });
}
