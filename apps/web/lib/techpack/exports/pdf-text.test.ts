import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PDF_FONT_FILE } from "@/lib/flat/pdf-font";
import { canDraw, coveredCodePoints, drawable, hasUndrawable } from "./pdf-text";

describe("what the PDF font can draw", () => {
  const covered = coveredCodePoints(readFileSync(PDF_FONT_FILE));

  it("reads the characters of the real font file", () => {
    expect(covered.size).toBeGreaterThan(300);
    for (const letter of "AZaz09 .,-+/()") expect(covered.has(letter.codePointAt(0) as number), letter).toBe(true);
    expect(covered.has("é".codePointAt(0) as number)).toBe(true);
    expect(covered.has("€".codePointAt(0) as number)).toBe(true);
  });

  it("does not hold emoji, Han characters or Arabic letters, which this font lacks", () => {
    for (const glyph of ["😀", "日", "م"]) expect(covered.has(glyph.codePointAt(0) as number), glyph).toBe(false);
  });

  it("refuses bytes that are not a font", () => {
    expect(() => coveredCodePoints(Buffer.from("not a font at all"))).toThrow();
    expect(() => coveredCodePoints(Buffer.alloc(0))).toThrow();
  });
});

describe("text made safe for the PDF", () => {
  it("keeps text the font can draw exactly as it is", () => {
    for (const text of ["Club shirt", "Crème brûlée 12", "€5 – ok", "Привет", "a b"]) {
      expect(drawable(text), text).toBe(text);
      expect(hasUndrawable(text), text).toBe(false);
    }
  });

  it("shows a character the font lacks as a question mark", () => {
    expect(drawable("a😀b")).toBe("a?b");
    expect(drawable("日本語")).toBe("???");
    expect(drawable("مرحبا x")).toBe("????? x");
    expect(hasUndrawable("a😀b")).toBe(true);
  });

  it("shows a whole emoji that is several code points as one question mark each, never a broken half", () => {
    const flag = "\u{1F1EC}\u{1F1E7}";
    expect(drawable(flag)).toBe("??");
    expect(drawable("\ud800")).toBe("?");
    expect(drawable("x\udc00y")).toBe("x?y");
  });

  it("turns line breaks and tabs into one space, and drops controls and invisible marks", () => {
    expect(drawable("line\nbreak")).toBe("line break");
    expect(drawable("a\r\nb")).toBe("a b");
    expect(drawable("tab\tin")).toBe("tab in");
    expect(drawable("a\u0000b\u0007c")).toBe("abc");
    expect(drawable("a​b‮c﻿d")).toBe("abcd");
    expect(hasUndrawable("a​b")).toBe(false);
  });

  it("joins a letter and its accent mark into one character the font has", () => {
    expect(drawable("é")).toBe("é");
  });

  it("never throws, for any string", () => {
    const strings = ["", "\u0000", "￿", "\u{10FFFF}", "x".repeat(10_000), "‮⁦", "\ud83d"];
    for (const text of strings) expect(() => drawable(text), JSON.stringify(text)).not.toThrow();
  });

  it("only ever gives back characters the font has", () => {
    const text = "a😀é日\u0000\n€ــ𝔘";
    for (const character of drawable(text)) expect(canDraw(character.codePointAt(0) as number), character).toBe(true);
  });
});
