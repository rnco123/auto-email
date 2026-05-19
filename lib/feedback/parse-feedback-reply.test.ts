import { describe, expect, it } from "vitest";
import { parseRatingReply, parseResolutionReply } from "./parse-feedback-reply";

describe("parseResolutionReply", () => {
  it("parses yes/no and digits", () => {
    expect(parseResolutionReply("yes")?.confirmed).toBe(true);
    expect(parseResolutionReply("2")?.confirmed).toBe(false);
    expect(parseResolutionReply("sí")?.confirmed).toBe(true);
    expect(parseResolutionReply("no")?.confirmed).toBe(false);
  });
});

describe("parseRatingReply", () => {
  it("parses 1-5 ratings", () => {
    expect(parseRatingReply("5")?.rating).toBe(5);
    expect(parseRatingReply("3 stars")?.rating).toBe(3);
    expect(parseRatingReply("hello")).toBeNull();
  });
});
