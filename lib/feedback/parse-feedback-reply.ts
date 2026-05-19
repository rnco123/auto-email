export type ParsedResolution = { confirmed: boolean };
export type ParsedRating = { rating: number };

const YES = new Set([
  "yes",
  "y",
  "si",
  "sí",
  "s",
  "resolved",
  "done",
  "ok",
  "okay",
]);

const NO = new Set([
  "no",
  "n",
  "not",
  "unresolved",
  "still",
  "help",
]);

/** Parse resolution reply from email/chat (1=yes, 2=no also supported). */
export function parseResolutionReply(text: string): ParsedResolution | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;

  if (t === "1" || YES.has(t)) return { confirmed: true };
  if (t === "2" || NO.has(t)) return { confirmed: false };

  const firstWord = t.split(/\s+/)[0]?.replace(/[.,!?]/g, "");
  if (firstWord && YES.has(firstWord)) return { confirmed: true };
  if (firstWord && NO.has(firstWord)) return { confirmed: false };

  if (/\b(yes|sí|si|resolved|resuelto|resuelta)\b/i.test(t))
    return { confirmed: true };
  if (/\b(no|not yet|aún no|todavía)\b/i.test(t)) return { confirmed: false };

  return null;
}

/** Parse 1–5 star rating from reply text. */
export function parseRatingReply(text: string): ParsedRating | null {
  const t = text.trim();
  const digit = t.match(/^[1-5]$/);
  if (digit) return { rating: Number(digit[0]) };

  const starMatch = t.match(/\b([1-5])\s*(?:\/\s*5|stars?|estrellas?)?\b/i);
  if (starMatch) return { rating: Number(starMatch[1]) };

  const outOf5 = t.match(/\b([1-5])\s*\/\s*5\b/);
  if (outOf5) return { rating: Number(outOf5[1]) };

  return null;
}
