import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { PROJECT, packFor } from "../../fixtures/designs";
import { allCells } from "../../walk";
import { allText } from "../fixtures/pdf-pages";
import { designWithTexts, noSpace, printed, readPdfOf, sourceOf } from "../fixtures/pdf-helpers";
import { drawable } from "../pdf-text";
import { CHARACTERS_REPLACED } from "./document";

/**
 * Text a person typed may hold any character. The PDF font lacks some, and the PDF library draws
 * a missing glyph as the wrong glyph and can garble the letters after it. So each such character is
 * shown as a question mark, the letters around it stay as they were, and the cover says so.
 */
const HOSTILE = [
  "😀 emoji",
  "日本語",
  "مرحبا",
  "a\u0000b\u0007c",
  "lone \ud800 surrogate",
  "‮evil‬",
  "\u{1F1EC}\u{1F1E7}",
  "𝔘𝔫𝔦",
  "combining é",
  "x".repeat(400),
  "=1+1",
  "<b>&\"'",
  "tab\tin",
  "Club 😀 shirt",
];

describe("text a person typed may hold any character", () => {
  it("never throws, makes a PDF, and prints every value made drawable with its source, for text in every field", async () => {
    const pack = packFor(designWithTexts(HOSTILE));
    const { bytes, pages, warnings } = await readPdfOf(pack);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const text = noSpace(allText(pages));
    const hostile = allCells(pack).filter(({ cell }) => cell.status === "set" && HOSTILE.some((entry) => String(cell.value).includes(entry.slice(0, 3))));
    expect(hostile.length).toBeGreaterThan(5);
    for (const { path, cell } of allCells(pack).filter(({ cell }) => cell.status === "set")) {
      expect(text, path).toContain(noSpace(`${drawable(printed(cell))}${sourceOf(cell)}`));
    }
    // A long word with no space in it is cut where the line ends, and is never lost.
    expect(warnings).toEqual([]);
  });

  it("shows a character the font lacks as a question mark, leaves the letters around it intact, and says so on the cover", async () => {
    const text = noSpace(allText((await readPdfOf(packFor(designWithTexts(["Club 😀 shirt"])))).pages));
    expect(text).toContain(noSpace("Club ? shirt"));
    expect(text).toContain(noSpace(CHARACTERS_REPLACED));
  });

  it("puts hostile text in the title, the footer and the metadata without harm, and draws a line break as a space", async () => {
    const project = { ...PROJECT, name: "line\nbreak ‮😀", styleNumber: "日本語", brandName: "مرحبا" };
    const { bytes, pages } = await readPdfOf(packFor(start("crew-tee"), { project }));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    for (const page of pages) expect(page.text).toContain("line break ? · ??? · Version 1");
  });

  it("says nothing about replaced characters when none was replaced", async () => {
    const project = { ...PROJECT, name: "line\nbreak" };
    const text = noSpace(allText((await readPdfOf(packFor(designWithTexts(["plain", "é ñ €"]), { project }))).pages));
    expect(text).not.toContain(noSpace(CHARACTERS_REPLACED));
    expect(text).toContain("linebreak");
  });

  it("holds no digit in the replaced-characters sentence", () => {
    expect(CHARACTERS_REPLACED).not.toMatch(/\d/);
  });
});
