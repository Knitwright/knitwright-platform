import { describe, expect, it } from "vitest";
import * as copy from "./copy";

/** Rule 3 (plan v4): no sentence reads as settled. Every sentence the screen can show is scanned. */
const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;

describe("the screen's sentences", () => {
  const sentences = [
    ...Object.values(copy).flatMap((value) => (typeof value === "string" ? [value] : [])),
    copy.priceText(5, true, 12, true),
    copy.priceText(1, false, null, false),
  ];

  it("never use a word that reads as settled", () => {
    expect(sentences.length).toBeGreaterThan(30);
    for (const sentence of sentences) expect(sentence).not.toMatch(SETTLED);
  });

  it("write the price in plain words, once for each saved version", () => {
    expect(copy.priceText(5, true, 12, false)).toBe("5 credits, once for each saved version. You have 12.");
    expect(copy.priceText(1, false, null, true)).toBe("1 credit, once for each saved version. Not charged yet. The price is a placeholder the owner has not set.");
  });
});
