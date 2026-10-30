import { describe, expect, it } from "vitest";
import { hasMarkup, isParaphrase, longestSharedRun, MAX_SHARED_WORDS, plain } from "./scrub";

/** The two things a benchmark may never keep: a page's source, and anybody's words copied out (spec F-S2 "Stored"). */

describe("markup", () => {
  it("sees a tag, a half-written tag and an entity", () => {
    expect(hasMarkup('<div class="price">')).toBe(true);
    expect(hasMarkup("5 < 7")).toBe(true);
    expect(hasMarkup("Smith &amp; Sons")).toBe(true);
    expect(hasMarkup("&#163;45")).toBe(true);
  });

  it("lets ordinary words and punctuation through", () => {
    expect(hasMarkup("88% polyester, 12% elastane — 140 g/m²")).toBe(false);
    expect(hasMarkup("Squat-proof")).toBe(false);
  });
});

describe("plain", () => {
  it("makes one line of words out of anything", () => {
    expect(plain("  the liner\n\trides   up \u0007 ")).toBe("the liner rides up");
  });
});

describe("a paraphrase, not a copy", () => {
  const review = "I love these shorts but the liner rides up every single time I go for a run over five miles.";

  it("counts the words a theme shares with the review, word for word", () => {
    expect(longestSharedRun("The liner rides up", review)).toBe(4);
    expect(longestSharedRun("Riding up at the thigh", review)).toBe(1);
    expect(longestSharedRun("", review)).toBe(0);
    expect(longestSharedRun("anything", "")).toBe(0);
  });

  it("keeps a short summary and refuses a longer copy", () => {
    expect(isParaphrase("The liner rides up", review)).toBe(true);
    expect(isParaphrase("the liner rides up every single time I go for a run", review)).toBe(false);
  });

  it("draws the line at the stated number of words", () => {
    const nine = "the liner rides up every single time I go";
    expect(longestSharedRun(nine, review)).toBe(MAX_SHARED_WORDS + 1);
    expect(isParaphrase(nine, review)).toBe(false);
  });
});
