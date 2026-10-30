import { describe, expect, it } from "vitest";
import { brandTabColours, brandTabFonts, kitFontRows } from "./brand-tab";
import { colour, palette } from "./fixtures/brand";
import type { KitFont } from "./types";

/** The rows the shared `<BrandTab>` takes. Y3 and later waves build theirs the same way. */

const KIT_FONTS: readonly KitFont[] = [
  { key: "geist", label: "Geist Sans", family: "var(--font-sans)", licence: "bundled", licenceNote: "SIL OFL 1.1, in the repository.", selectable: true },
  { key: "placeholder-block", label: "Placeholder: wide block sans", family: "", licence: "not_established", licenceNote: "No licence on file.", selectable: false },
];

describe("brandTabColours", () => {
  it("carries the estimate's answer, so no picker works a colour out for itself", () => {
    const rows = brandTabColours([palette({ colours: [colour({ hex: "#0000ff", name: "Electric" })] })]);
    expect(rows[0]).toMatchObject({ key: "c1", name: "Electric", paletteName: "Primary", hex: "#0000ff", inGamut: false });
    expect(rows[0]!.safeHex).not.toBe("#0000ff");
    expect(rows[0]!.warning).toContain("Knitwright's own estimate");
  });

  it("leaves the warning empty for a colour the estimate accepts", () => {
    expect(brandTabColours([palette({ colours: [colour({ hex: "#0b1f4b" })] })])[0]!.warning).toBeNull();
  });

  it("keeps the palette name on every row, so the tab can group them", () => {
    const rows = brandTabColours([
      palette({ id: "p1", name: "Primary", colours: [colour({ id: "a" })] }),
      palette({ id: "p2", name: "Club kit", source: "club-kit", colours: [colour({ id: "b" })] }),
    ]);
    expect(rows.map((row) => row.paletteName)).toEqual(["Primary", "Club kit"]);
  });

  it("has no rows for a brand with no palette", () => {
    expect(brandTabColours([])).toEqual([]);
  });
});

describe("brandTabFonts", () => {
  it("shows the font set for each role, in the spec's order", () => {
    const rows = brandTabFonts(
      [
        { role: "body", fontKey: "geist" },
        { role: "headline", fontKey: "geist" },
      ],
      KIT_FONTS,
    );
    expect(rows.map((row) => row.roleLabel)).toEqual(["Headline", "Body"]);
    expect(rows[0]!.key).toBe("headline:geist");
  });

  it("leaves out a role with no font, rather than guessing one", () => {
    expect(brandTabFonts([{ role: "accent", fontKey: null }], KIT_FONTS)).toEqual([]);
  });

  it("leaves out a key the font list does not hold", () => {
    expect(brandTabFonts([{ role: "accent", fontKey: "mystery" }], KIT_FONTS)).toEqual([]);
  });

  it("carries the licence note, and never calls a font licensed when it is not", () => {
    const rows = brandTabFonts([{ role: "accent", fontKey: "placeholder-block" }], KIT_FONTS);
    expect(rows[0]).toMatchObject({ licence: "not_established", selectable: false, family: null, licenceNote: "No licence on file." });
  });
});

describe("kitFontRows", () => {
  it("offers the whole list with each row's licence, and no family for a placeholder", () => {
    expect(kitFontRows(KIT_FONTS)).toEqual([
      { key: "geist", label: "Geist Sans", roleLabel: null, family: "var(--font-sans)", licence: "bundled", licenceNote: "SIL OFL 1.1, in the repository.", selectable: true },
      { key: "placeholder-block", label: "Placeholder: wide block sans", roleLabel: null, family: null, licence: "not_established", licenceNote: "No licence on file.", selectable: false },
    ]);
  });
});
