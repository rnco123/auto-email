import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./pricing";

describe("estimateCostUsd", () => {
  it("computes gpt-4.1 input + output cost", () => {
    const cost = estimateCostUsd("gpt-4.1", 1_000_000, 500_000);
    expect(cost).toBe(6);
  });

  it("uses prefix match for dated model ids", () => {
    const cost = estimateCostUsd("gpt-4o-mini-2024-07-18", 1_000_000, 0);
    expect(cost).toBe(0.15);
  });

  it("falls back to gpt-4.1 pricing for unknown models", () => {
    const cost = estimateCostUsd("unknown-model", 1_000_000, 0);
    expect(cost).toBe(2);
  });

  it("returns zero for zero tokens", () => {
    expect(estimateCostUsd("gpt-4.1", 0, 0)).toBe(0);
  });
});
