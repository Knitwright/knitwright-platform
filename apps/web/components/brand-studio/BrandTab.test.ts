import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandTab, type BrandTabColour, type BrandTabFont, type BrandTabProps } from "./BrandTab";

/**
 * The shared Brand tab (F-S9). Y3's Library toolbar and the wave 4 launch editor drop this into
 * their own pickers, so these tests pin the contract: what it shows, what it never claims, and that
 * it works with nothing but rows and a callback.
 */

const render = (props: BrandTabProps): string => renderToStaticMarkup(createElement(BrandTab, props));

const colour = (over: Partial<BrandTabColour> = {}): BrandTabColour => ({
  key: "c1",
  name: "Club red",
  paletteName: "Primary",
  hex: "#c8102e",
  safeHex: "#c8102e",
  inGamut: true,
  pantoneTcx: "19-1664 TCX",
  warning: null,
  ...over,
});

const font = (over: Partial<BrandTabFont> = {}): BrandTabFont => ({
  key: "headline:geist",
  label: "Geist Sans",
  roleLabel: "Headline",
  family: "var(--font-sans)",
  licence: "bundled",
  licenceNote: "SIL Open Font License 1.1, in this repository.",
  selectable: true,
  ...over,
});

describe("the colour tab", () => {
  it("shows each colour with its hex and the Pantone code the brand typed", () => {
    const html = render({ subject: "colour", colours: [colour()] });
    expect(html).toContain("Club red");
    expect(html).toContain("#c8102e");
    expect(html).toContain("19-1664 TCX");
  });

  it("says plainly when a colour carries no Pantone code, rather than inventing one", () => {
    expect(render({ subject: "colour", colours: [colour({ pantoneTcx: null })] })).toContain("no Pantone TCX code yet");
  });

  it("groups colours under their palette's name", () => {
    const html = render({
      subject: "colour",
      colours: [colour({ key: "a", paletteName: "Primary" }), colour({ key: "b", paletteName: "Club kit" })],
    });
    expect(html.indexOf("Primary")).toBeLessThan(html.indexOf("Club kit"));
  });

  it("shows the nearest estimated-safe swatch only for a colour outside the estimate", () => {
    const inside = render({ subject: "colour", colours: [colour()] });
    const outside = render({ subject: "colour", colours: [colour({ inGamut: false, safeHex: "#b4203a", warning: "An estimate." })] });
    expect(inside).not.toContain("may print duller");
    expect(outside).toContain("may print duller");
    expect(outside).toContain("#b4203a");
  });

  it("leaves the safe swatch out when the caller turns it off", () => {
    expect(render({ subject: "colour", colours: [colour({ inGamut: false, warning: "An estimate." })], showGamut: false })).not.toContain("may print duller");
  });

  it("marks the current colour, and marks nothing when there is none", () => {
    expect(render({ subject: "colour", colours: [colour()], selectedKey: "c1" })).toContain('aria-current="true"');
    expect(render({ subject: "colour", colours: [colour()] })).not.toContain("aria-current");
  });

  it("disables every row when no callback is given, so a read-only tab cannot be pressed", () => {
    expect(render({ subject: "colour", colours: [colour()] })).toContain("disabled");
  });
});

describe("the font tab", () => {
  it("shows the role each font is set for", () => {
    const html = render({ subject: "font", fonts: [font()] });
    expect(html).toContain("Geist Sans");
    expect(html).toContain("Headline");
  });

  it("never implies a licence: a font with none is shown disabled with its note", () => {
    const html = render({
      subject: "font",
      fonts: [font({ key: "placeholder-block", label: "Placeholder: wide block sans", selectable: false, licence: "not_established", licenceNote: "No licence on file.", family: null })],
    });
    expect(html).toContain("no licence on file");
    expect(html).toContain("No licence on file.");
    expect(html).toContain("disabled");
  });

  it("previews with the family it was given, and with none when no file is bundled", () => {
    expect(render({ subject: "font", fonts: [font()] })).toContain("var(--font-sans)");
    expect(render({ subject: "font", fonts: [font({ family: null })] })).not.toContain("font-family");
  });
});

describe("an empty tab", () => {
  it("says what is missing and offers the brand page", () => {
    const html = render({ subject: "colour", colours: [] });
    expect(html).toContain("This brand has no palette yet.");
    expect(html).toContain("/brand-studio");
    expect(html).toContain("Set up your brand");
  });

  it("says the same for fonts, and takes the caller's own words and link", () => {
    expect(render({ subject: "font", fonts: [] })).toContain("This brand has no font set yet.");
    const html = render({ subject: "font", fonts: [], emptyMessage: "Nothing here.", manageHref: "/brand-studio?tab=fonts" });
    expect(html).toContain("Nothing here.");
    expect(html).toContain("/brand-studio?tab=fonts");
  });
});
