/** USD per 1M tokens — OpenAI published rates (May 2025). */
export const MODEL_PRICING_USD_PER_1M: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10.0, output: 30.0 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
};

const DEFAULT_PRICING = MODEL_PRICING_USD_PER_1M["gpt-4.1"];

function resolvePricing(model: string): { input: number; output: number } {
  if (MODEL_PRICING_USD_PER_1M[model]) {
    return MODEL_PRICING_USD_PER_1M[model];
  }
  const prefix = Object.keys(MODEL_PRICING_USD_PER_1M)
    .filter((key) => model.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  if (prefix) return MODEL_PRICING_USD_PER_1M[prefix];
  return DEFAULT_PRICING;
}

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const { input, output } = resolvePricing(model);
  const cost =
    (promptTokens / 1_000_000) * input +
    (completionTokens / 1_000_000) * output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
