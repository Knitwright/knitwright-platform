import { describe, expect, it } from "vitest";
import { findPhrase, wordsOf } from "./normalise";
import { screenTextContent, TEXT_CONTEXTS } from "./text";
import type { Mark } from "./types";

const MARKS: readonly Mark[] = [
  { id: "1", holder: "The Arsenal Football Club", markText: "Arsenal", imageHash: null },
  { id: "2", holder: "Nike, Inc.", markText: "Nike", imageHash: null },
  { id: "3", holder: "Manchester United", markText: "Manchester United", imageHash: null },
  { id: "4", holder: "Picture only", markText: null, imageHash: "0".repeat(16) },
];

const screen = (text: string, context: (typeof TEXT_CONTEXTS)[number] = "title") => screenTextContent(text, context, MARKS);
const codes = (text: string, context?: (typeof TEXT_CONTEXTS)[number]) => screen(text, context).reasons.map((r) => r.code);

describe("normalising text", () => {
  it("removes accents, case and character swaps, and splits into words", () => {
    expect(wordsOf("N1KE Café-Club $hit 10")).toEqual(["nike", "cafe", "club", "shit", "10"]);
  });

  it("keeps a number a number", () => {
    expect(wordsOf("Smith 7")).toEqual(["smith", "7"]);
  });

  it("finds a phrase of whole words only", () => {
    expect(findPhrase(["man", "united"], ["united"])).toBe(1);
    expect(findPhrase(["manchester"], ["manchester", "united"])).toBe(-1);
    expect(findPhrase(["a"], [])).toBe(-1);
  });
});

describe("third-party brand names", () => {
  it('blocks "Arsenal" in a product title, because it is on the blocklist', () => {
    const verdict = screen("Arsenal home shirt");
    expect(verdict.result).toBe("blocked");
    expect(verdict.reasons[0]).toMatchObject({ code: "brand_term", term: "Arsenal", ruleId: "R-GAP-000" });
  });

  it("only flags the same word in a name, a slogan, a label or a prompt", () => {
    for (const context of ["name", "slogan", "label", "prompt"] as const) {
      expect(screen("Arsenal", context).result, context).toBe("flagged");
    }
  });

  it("does not block a word that is not on the blocklist (false positives)", () => {
    expect(screen("Hackney Wanderers home shirt").result).toBe("clear");
    expect(screen("Arsenalistas training top").result).toBe("clear");
    expect(screen("Manchester Rugby Club").result).toBe("clear");
    expect(screen("Nikolai 9", "name").result).toBe("clear");
  });

  it("matches a mark of several words, and a disguised one", () => {
    expect(codes("Manchester United retro")).toEqual(["brand_term"]);
    expect(codes("N1ke running vest")).toEqual(["brand_term"]);
    expect(codes("NIKE'S best")).toEqual(["brand_term"]);
  });
});

describe("product title rules", () => {
  it('blocks "dupe" in a title only', () => {
    expect(screen("Running shorts dupe").result).toBe("blocked");
    expect(codes("Running shorts DUPES")).toEqual(["dupe_title"]);
    expect(screen("Dupe", "name").result).toBe("clear");
  });

  it('blocks "inspired by <brand>" and flags "inspired by" anything else', () => {
    const named = screen("Shorts inspired by Nike");
    expect(named.result).toBe("blocked");
    expect(named.reasons.map((r) => r.code).sort()).toEqual(["brand_term", "inspired_by"]);
    const unnamed = screen("Shorts inspired by the sea");
    expect(unnamed.result).toBe("flagged");
    expect(unnamed.reasons[0]).toMatchObject({ code: "inspired_by", severity: "flag" });
  });

  it("clears an ordinary title", () => {
    expect(screen("Club training shorts, navy")).toEqual({ result: "clear", reasons: [] });
  });
});

describe("offensive words", () => {
  it("blocks strong words and slurs in names and slogans", () => {
    expect(screen("SH1T 9", "name").result).toBe("blocked");
    expect(screen("fuckoff fc", "slogan").result).toBe("blocked");
    expect(screen("Bitches FC", "slogan").result).toBe("blocked");
  });

  it("only flags words that are also names or ordinary words", () => {
    const verdict = screen("Dick 4", "name");
    expect(verdict.result).toBe("flagged");
    expect(verdict.reasons[0]).toMatchObject({ code: "profanity", severity: "flag", term: "dick" });
  });

  it("never matches inside a longer word (false positives)", () => {
    for (const text of ["Scunthorpe United", "Dickson", "Essex", "Cockburn", "Shitake", "Penistone", "Arsenault", "Hancock"]) {
      expect(screen(text, "name").result, text).toBe("clear");
    }
  });
});
