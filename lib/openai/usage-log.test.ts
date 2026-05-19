import { describe, expect, it } from "vitest";
import { usageFromCompletion } from "./usage-log";

describe("usageFromCompletion", () => {
  it("reads token counts from completion usage", () => {
    const result = usageFromCompletion({
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    });
    expect(result).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
  });

  it("defaults missing usage to zero", () => {
    expect(usageFromCompletion({})).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });

  it("sums prompt and completion when total omitted", () => {
    const result = usageFromCompletion({
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
    expect(result.totalTokens).toBe(15);
  });
});
