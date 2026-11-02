import { describe, expect, it } from "vitest";
import { finishedRecord, palette, record } from "@/lib/brand-studio/fixtures/brand";
import { kitFonts } from "@/lib/brand-studio/import/fixtures/site";
import { brandView } from "./brand";
import { brandIsEmpty } from "./view";

/**
 * The brand panel's own rows (plan v5, decision 0106).
 *
 * Two things are proved: the rows are Y6's own (`brandTabColours` and `brandTabFonts`), so the
 * sublimation estimate and every licence note are worked out in one place; and a font the brand
 * holds no licence for is shown with its note rather than being offered or hidden.
 */

describe("the brand panel's view", () => {
  it("groups each palette with its own colours and the estimate already worked out", () => {
    const view = brandView(finishedRecord(), kitFonts());
    expect(view.palettes).toHaveLength(1);
    expect(view.palettes[0]?.name).toBe("Primary");
    const first = view.palettes[0]!.colours[0]!;
    expect(first.hex).toBe("#c8102e");
    expect(typeof first.inGamut).toBe("boolean");
    expect(first.safeHex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("leaves out a palette with no colour in it, rather than showing an empty row", () => {
    const view = brandView(record({ palettes: [palette({ colours: [] })] }), kitFonts());
    expect(view.palettes).toEqual([]);
  });

  it("shows a type style for each role the brand chose, with the licence note beside it", () => {
    const view = brandView(finishedRecord(), kitFonts());
    expect(view.fonts.length).toBeGreaterThan(0);
    for (const font of view.fonts) expect(font.licenceNote.length).toBeGreaterThan(0);
    expect(view.anyFontSelectable).toBe(true);
  });

  it("says no type style can be set when the brand holds a licence for none of them", () => {
    const unlicensed = kitFonts().map((font) => ({ ...font, selectable: false, licence: "not_established" as const }));
    const view = brandView(finishedRecord(), unlicensed);
    expect(view.anyFontSelectable).toBe(false);
    for (const font of view.fonts) expect(font.selectable).toBe(false);
  });

  it("shows the voice words and only the visual-style texts the brand has written", () => {
    const view = brandView(finishedRecord(), kitFonts());
    expect(view.voice).toEqual(["Community"]);
    expect(view.style.map((text) => text.label)).toHaveLength(3);
    const half = brandView(record({ profile: { ...finishedRecord().profile, style: { setting: "A wet pitch.", artDirection: "", rulesBoundaries: "  " } } }), kitFonts());
    expect(half.style).toHaveLength(1);
  });

  it("is empty for a brand that has saved nothing, so the panel draws its empty state", () => {
    expect(brandIsEmpty(brandView(record(), kitFonts()))).toBe(true);
    expect(brandIsEmpty(brandView(finishedRecord(), kitFonts()))).toBe(false);
  });
});
