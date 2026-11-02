import { describe, expect, it } from "vitest";
import { FONT_ROLES } from "../words";
import { fontDetail, fontFor, kindOf, nearestUsable, proposedFonts, roleWants } from "./fonts";
import { kitFonts } from "./fixtures/site";
import { RULES } from "./words";

/**
 * "Fonts (closest licensed match)". The list is `brand_studio_fonts`, where only the two bundled
 * Geist faces have a licence on file (decision 0079), so almost every answer here has to say that
 * the nearest font Knitwright may use is **not** the brand's font. That is the point of the tests.
 */

const fonts = kitFonts();

describe("kindOf", () => {
  it.each([
    ["Geist Mono", "mono"],
    ["Ravensmoor Stencil", "stencil"],
    ["Archivo Condensed", "condensed"],
    ["Bebas Neue", "display"],
    ["Source Serif 4", "serif"],
    ["Ravensmoor Grotesk", "sans"],
    ["Something Else", "sans"],
  ])("reads %s as a %s face", (name, kind) => {
    expect(kindOf(name)).toBe(kind);
  });
});

describe("nearestUsable", () => {
  it("offers only a font whose licence is in this repository", () => {
    const near = nearestUsable("Bebas Neue", fonts);
    expect(near.font?.key).toBe("geist");
    expect(near.font?.selectable).toBe(true);
  });

  it("prefers a font of the same kind of face when one is usable", () => {
    const near = nearestUsable("JetBrains Mono", fonts);
    expect(near.font?.key).toBe("geist-mono");
    expect(near.sameKind).toBe(true);
  });

  it("says the kind differs when nothing usable is of the same kind", () => {
    expect(nearestUsable("Source Serif 4", fonts).sameKind).toBe(false);
  });

  it("offers nothing at all when no row has a licence on file", () => {
    const none = fonts.map((font) => ({ ...font, selectable: false }));
    expect(nearestUsable("Bebas Neue", none).font).toBeNull();
  });
});

describe("fontFor", () => {
  it("says plainly that the nearest font is not the brand's font", () => {
    const font = fontFor("headline", "Bebas Neue", fonts);
    expect(font.isSameFont).toBe(false);
    expect(font.fontKey).toBe("geist");
    const note = font.notes.find((one) => one.ruleId === RULES.fontLicence);
    expect(note?.message).toContain("Bebas Neue");
    expect(note?.message).toMatch(/nearest|different kind/);
    expect(note?.severity).toBe("warning");
  });

  it("says the nearest is of the same kind of face when it is", () => {
    const font = fontFor("body", "JetBrains Mono", fonts);
    expect(font.fontKey).toBe("geist-mono");
    expect(font.notes[0]?.message).toContain("is the nearest font Knitwright may use");
    expect(font.notes[0]?.message).toContain("it will not look the same");
  });

  it("takes the brand's own font when the brand's own font is one Knitwright may use", () => {
    const font = fontFor("body", "geist sans", fonts);
    expect(font).toMatchObject({ isSameFont: true, fontKey: "geist", fontLabel: "Geist Sans" });
    expect(font.notes).toEqual([]);
  });

  it("offers nothing, and says why, when no font has a licence on file", () => {
    const none = fonts.map((font) => ({ ...font, selectable: false }));
    const font = fontFor("headline", "Bebas Neue", none);
    expect(font.fontKey).toBeNull();
    expect(font.notes[0]?.message).toContain("licence");
  });

  it("never guesses a name and number font from a web page, and says why", () => {
    const font = fontFor("name_number", null, fonts);
    expect(font).toMatchObject({ wanted: null, fontKey: null, isSameFont: false });
    expect(font.notes.map((note) => note.ruleId)).toEqual([RULES.fontLicence, RULES.fineDetail]);
    expect(font.notes[0]?.message).toContain("kit font");
  });

  it("carries the rulebook's own fine-detail rule on the name and number row", () => {
    expect(fontFor("name_number", "Bebas Neue", fonts).notes.some((note) => note.ruleId === "R-SUB-007")).toBe(true);
  });

  it("says so rather than nothing when a page named no font for a role", () => {
    const font = fontFor("accent", null, fonts);
    expect(font.notes[0]?.ruleId).toBe(RULES.fontLicence);
    expect(fontDetail(font)).toBe("Nothing to match");
  });
});

describe("roleWants", () => {
  it("offers the first family as the headline and the second as the body", () => {
    expect(roleWants(["Bebas Neue", "Source Serif 4", "Ravensmoor Grotesk"])).toEqual({
      headline: "Bebas Neue",
      subheadline: "Source Serif 4",
      body: "Source Serif 4",
      accent: "Ravensmoor Grotesk",
      name_number: null,
    });
  });

  it("uses the one family everywhere when a page names one", () => {
    const wants = roleWants(["Ravensmoor Grotesk"]);
    expect([wants.headline, wants.subheadline, wants.body, wants.accent]).toEqual(Array(4).fill("Ravensmoor Grotesk"));
  });

  it("wants nothing at all when a page names no family", () => {
    expect(Object.values(roleWants([])).every((want) => want === null)).toBe(true);
  });
});

describe("proposedFonts", () => {
  it("answers for all five roles of F-S9, in the spec's order", () => {
    expect(proposedFonts(["Bebas Neue"], fonts).map((font) => font.role)).toEqual([...FONT_ROLES]);
  });

  it("offers a font Knitwright may use for the four text roles and none for name and number", () => {
    const proposed = proposedFonts(["Bebas Neue", "Source Serif 4"], fonts);
    expect(proposed.filter((font) => font.fontKey !== null).map((font) => font.role)).toEqual(["headline", "subheadline", "body", "accent"]);
  });

  it("never says a font is the brand's own unless it is", () => {
    expect(proposedFonts(["Bebas Neue", "Source Serif 4"], fonts).some((font) => font.isSameFont)).toBe(false);
  });
});

describe("fontDetail", () => {
  it("says which font is offered and what it is nearest to", () => {
    expect(fontDetail(fontFor("headline", "Bebas Neue", fonts))).toBe("Geist Sans · nearest to Bebas Neue");
    expect(fontDetail(fontFor("body", "Geist Sans", fonts))).toBe("Geist Sans · your own font");
  });

  it("says when there is nothing Knitwright may use", () => {
    const none = fonts.map((font) => ({ ...font, selectable: false }));
    expect(fontDetail(fontFor("headline", "Bebas Neue", none))).toBe("Bebas Neue · nothing Knitwright may use");
  });
});
