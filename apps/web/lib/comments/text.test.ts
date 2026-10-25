import { describe, expect, it } from "vitest";
import { cleanComment, COMMENT_MAX_LENGTH, EMPTY_COMMENT } from "./text";

describe("cleanComment", () => {
  it("keeps ordinary words, punctuation and non-Latin letters", () => {
    expect(cleanComment("Crest 2cm lower? Ça va, 谢谢 – OK!")).toEqual({ ok: true, text: "Crest 2cm lower? Ça va, 谢谢 – OK!" });
  });

  it("removes control and direction-override characters", () => {
    expect(cleanComment("a\u0000b‮c​d\u0007")).toEqual({ ok: true, text: "abcd" });
  });

  it("normalises to composed form", () => {
    expect(cleanComment("é")).toEqual({ ok: true, text: "é" });
  });

  it("keeps line breaks, turns tabs and runs of spaces into one space, and limits blank lines", () => {
    expect(cleanComment("one  \t two\r\n\r\n\r\n\r\nthree \n four")).toEqual({ ok: true, text: "one two\n\nthree\nfour" });
  });

  it("refuses a comment with nothing in it", () => {
    for (const raw of ["", "   ", "\n\t​\n"]) expect(cleanComment(raw)).toEqual({ ok: false, message: EMPTY_COMMENT });
  });

  it("refuses a comment over the limit after cleaning, and accepts one at the limit", () => {
    expect(cleanComment("x".repeat(COMMENT_MAX_LENGTH)).ok).toBe(true);
    const over = cleanComment("x".repeat(COMMENT_MAX_LENGTH + 1));
    expect(over.ok).toBe(false);
  });

  it("does not count characters it removes", () => {
    expect(cleanComment(`${"x".repeat(COMMENT_MAX_LENGTH)}​​`).ok).toBe(true);
  });

  it("leaves markup as text, for the page to show as text", () => {
    expect(cleanComment("<script>alert(1)</script>")).toEqual({ ok: true, text: "<script>alert(1)</script>" });
  });
});
