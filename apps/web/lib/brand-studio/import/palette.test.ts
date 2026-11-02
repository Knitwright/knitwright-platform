import { describe, expect, it } from "vitest";
import { IMPORTED_PALETTE_NAME, colourOf, distinct, proposedColours, seenColours } from "./palette";
import { DEFAULT_IMPORT_SETTINGS } from "./settings";
import { RULES } from "./words";
import type { PictureFacts } from "./types";

/**
 * The palette an import proposes. Nothing here may invent a colour value, work out a Pantone code,
 * or state a colour match: the arithmetic is `lib/colour`'s own, in the platform's published sRGB /
 * D65 / 2 degree convention (owner decision 15), and the gamut answer is an estimate that says so.
 */

const settings = DEFAULT_IMPORT_SETTINGS;

const picture = (swatches: readonly (readonly [string, number])[]): PictureFacts => ({
  url: "https://ravensmoor.test/media/logo.png",
  why: "img-logo",
  alt: null,
  contentType: "image/png",
  widthPx: 64,
  heightPx: 64,
  bytes: 400,
  swatches: swatches.map(([hex, share]) => ({ hex, share })),
});

describe("seenColours", () => {
  it("weighs a stylesheet colour by how early the page names it", () => {
    const seen = seenColours(["#0b1f4b", "#777777"], []);
    expect(seen.map((one) => one.hex)).toEqual(["#0b1f4b", "#777777"]);
    expect(seen[0]?.share).toBeNull();
    expect(seen[0]?.from).toContain("styles");
  });

  it("weighs a picture's colour by how much of the picture holds it", () => {
    const seen = seenColours([], [picture([["#ffd100", 0.2], ["#0b1f4b", 0.8]])]);
    expect(seen.map((one) => one.hex)).toEqual(["#0b1f4b", "#ffd100"]);
    expect(seen[0]?.share).toBe(0.8);
    expect(seen[0]?.from).toContain("logo");
  });

  it("says a colour came from the brand's logo or from one of its other pictures", () => {
    const logo = seenColours([], [picture([["#0b1f4b", 0.9]])]);
    expect(logo[0]?.from).toContain("logo");
    const favicon = { ...picture([["#0b1f4b", 0.9]]), why: "favicon" as const };
    expect(seenColours([], [favicon])[0]?.from).toContain("logo");
    const photo = { ...picture([["#0b1f4b", 0.9]]), why: "img-product" as const };
    expect(seenColours([], [photo])[0]?.from).toContain("picture");
  });

  it("leaves out the paper a page is printed on, because white is not a brand colour", () => {
    expect(seenColours(["#ffffff", "#0b1f4b"], []).map((one) => one.hex)).toEqual(["#0b1f4b"]);
  });
});

describe("distinct", () => {
  it("folds two colours an eye could not tell apart into the heavier one", () => {
    const seen = seenColours(["#0b1f4b", "#0b1f4c"], []);
    expect(distinct(seen, settings.colourGap).map((one) => one.hex)).toEqual(["#0b1f4b"]);
  });

  it("keeps two colours that are genuinely different", () => {
    expect(distinct(seenColours(["#0b1f4b", "#ffd100"], []), settings.colourGap)).toHaveLength(2);
  });
});

describe("colourOf", () => {
  it("keeps the brand's own colour and shows the estimate's nearest beside it", () => {
    const [seen] = seenColours(["#ff0090"], []);
    const colour = colourOf(seen!);
    expect(colour.hex).toBe("#ff0090");
    expect(colour.inGamut).toBe(false);
    expect(colour.safeHex).not.toBe("#ff0090");
    expect(colour.deltaE).toBeGreaterThan(0);
  });

  it("never works out a Pantone code, because no Pantone data ships", () => {
    const [seen] = seenColours(["#0b1f4b"], []);
    expect(colourOf(seen!).pantoneTcx).toBeNull();
  });

  it("says a screen colour has no factory reference yet, under the strike-off rule", () => {
    const [seen] = seenColours(["#0b1f4b"], []);
    const notes = colourOf(seen!).notes;
    expect(notes.some((note) => note.ruleId === RULES.colourStrikeOff)).toBe(true);
  });

  it("carries the gamut warning under R-GAP-000, and the warning says it is an estimate", () => {
    const [seen] = seenColours(["#ff0090"], []);
    const warning = colourOf(seen!).notes.find((note) => note.ruleId === RULES.gamutEstimate);
    expect(warning?.ruleId).toBe("R-GAP-000");
    expect(warning?.message).toMatch(/estimate/i);
  });

  it("passes the rulebook's own advice on about pure RGB black", () => {
    const [seen] = seenColours(["#000000"], []);
    const note = colourOf(seen!).notes.find((one) => one.ruleId === RULES.richBlack);
    expect(note?.ruleId).toBe("R-SUB-008");
  });

  it("warns about nothing when a colour is already inside the estimate", () => {
    const [seen] = seenColours(["#5a5a5a"], []);
    const colour = colourOf(seen!);
    expect(colour.inGamut).toBe(true);
    expect(colour.deltaE).toBe(0);
    expect(colour.notes.some((note) => note.ruleId === RULES.gamutEstimate)).toBe(false);
  });
});

describe("proposedColours", () => {
  it("proposes the page's own colours, heaviest first, up to the allowance", () => {
    const colours = proposedColours(["#0b1f4b", "#ffd100", "#c8102e", "#2f6f4f"], [], { ...settings, colours: 3 });
    expect(colours.map((colour) => colour.hex)).toEqual(["#0b1f4b", "#ffd100", "#c8102e"]);
  });

  it("reads a picture's colours as well as a stylesheet's", () => {
    const colours = proposedColours([], [picture([["#0b1f4b", 0.9]])], settings);
    expect(colours.map((colour) => colour.hex)).toEqual(["#0b1f4b"]);
    expect(colours[0]?.share).toBe(0.9);
  });

  it("gives an empty palette, not a guessed one, when a page states no colour", () => {
    expect(proposedColours([], [], settings)).toEqual([]);
  });

  it("offers the palette under a name a person then changes", () => {
    expect(IMPORTED_PALETTE_NAME).toBe("From your site");
  });
});
