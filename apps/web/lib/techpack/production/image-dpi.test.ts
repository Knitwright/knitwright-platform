import { describe, expect, it } from "vitest";
import { gradedJersey } from "@/lib/print/fixtures/graded";
import { ALL_KINDS_STACK, ASSETS, CREST_LAYER, GRAPHIC_STACK, GROUND_STACK, LOW_DPI_ACCEPTED, PANEL_STACK, SMALL_CREST, TILE_STACK } from "../fixtures/stacks";
import { DEFAULT_MIN_DPI_SETTING, imageNote, imageRows, minDpiOf } from "./image-dpi";

const pattern = gradedJersey(["46", "48", "50"]);
const DEFAULT = DEFAULT_MIN_DPI_SETTING;

describe("the minimum resolution", () => {
  it("is the print house's, else Knitwright's default of 150, labelled as one", () => {
    expect(minDpiOf({ minDpi: { value: 200, source: "print-house" } })).toEqual({ value: 200, source: "print-house" });
    expect(minDpiOf({})).toEqual({ value: 150, source: "knitwright-default" });
    expect(minDpiOf({ minDpi: null })).toEqual(DEFAULT);
  });
  it("says in words where it came from", () => {
    expect(imageNote(DEFAULT, 1)).toContain("150 dpi. Knitwright default, not from your print house.");
    expect(imageNote({ value: 200, source: "print-house" }, 1)).toContain("200 dpi. From your print house.");
  });
  it("says the pictures were measured at the print scale when it is not 1", () => {
    expect(imageNote(DEFAULT, 1.0204)).toContain("enlarged by 1.0204");
    expect(imageNote(DEFAULT, 1)).not.toContain("enlarged");
  });
});

describe("the resolution of every placed picture", () => {
  const rows = (stack = ALL_KINDS_STACK, extra: Partial<Parameters<typeof imageRows>[1]> = {}) =>
    imageRows(stack, { assets: ASSETS, minDpi: DEFAULT, scale: 1, acceptances: [], pattern, ...extra });

  it("works out pixels over the printed width for a placed picture and for a repeating one", () => {
    const [tile, crest, logo] = rows();
    expect(crest).toMatchObject({ layerId: "crest", picture: "Club crest", pixels: "1200 x 1200 px", result: "meets" });
    expect(crest?.printedWidth).toMatchObject({ status: "set", tenthsMm: 900 });
    expect(crest?.dpi).toMatchObject({ status: "set", number: 339 });
    expect(tile).toMatchObject({ layerId: "club-tile", result: "meets" });
    expect(tile?.dpi).toMatchObject({ number: 150 });
    expect(logo).toMatchObject({ layerId: "sleeve-logo", result: "unknown" });
  });

  it("warns, in plain words and with the largest size that still meets the minimum, for a picture below it", () => {
    const [low] = rows(GRAPHIC_STACK, { assets: [SMALL_CREST] });
    expect(low).toMatchObject({ layerId: "crest", result: "below" });
    expect(low?.dpi).toMatchObject({ number: 113 });
    expect(low?.sentence).toBe(
      "This picture would print at about 113 dpi at this size. Your print house asks for 150 or more, so it may look soft. Use a larger file, or make it smaller on the shirt. The largest size at which it still meets 150 dpi is about 68 mm wide.",
    );
  });

  it("shows who accepted a picture below the minimum, by name and date", () => {
    const [accepted] = rows(GRAPHIC_STACK, { assets: [SMALL_CREST], acceptances: [LOW_DPI_ACCEPTED] });
    expect(accepted).toMatchObject({ result: "below", acceptedBy: { status: "set", value: "Sam Lee on 11 Oct 2026" } });
    const [open] = rows(GRAPHIC_STACK, { assets: [SMALL_CREST] });
    expect(open?.acceptedBy).toEqual({ status: "to-be-confirmed" });
  });

  it("never warns for a vector", () => {
    const stack = { ...GRAPHIC_STACK, layers: GRAPHIC_STACK.layers.map((layer) => (layer.id === "crest" ? { ...CREST_LAYER, source: { kind: "asset" as const, assetId: "vector-1" } } : layer)) };
    const [vector] = rows(stack as typeof GRAPHIC_STACK);
    expect(vector).toMatchObject({ result: "vector", dpi: null, sentence: "A vector picture has no resolution to meet." });
  });

  it("says plainly when it cannot know a picture's resolution", () => {
    const [unknown] = rows(GRAPHIC_STACK, { assets: [] });
    expect(unknown).toMatchObject({ result: "unknown", dpi: null, printedWidth: { status: "set" } });
    expect(unknown?.sentence).toBe("The size of this picture is not on record, so its resolution is not known. Upload it again through the artwork upload.");
    const old = rows(GRAPHIC_STACK).find((row) => row.layerId === "sleeve-logo");
    expect(old?.pixels).toBe("Not on record");
  });

  it("measures a picture enlarged by the print scale at the lower resolution it then has", () => {
    const [scaled] = rows(GRAPHIC_STACK, { scale: 1.0204 });
    expect(scaled?.printedWidth).toMatchObject({ tenthsMm: 918 });
    expect(scaled?.dpi).toMatchObject({ number: 332 });
  });

  it("measures a full-panel picture against the piece it covers on the largest size", () => {
    const [panel] = rows(PANEL_STACK);
    expect(panel).toMatchObject({ layerId: "front-art", result: "meets" });
    expect(panel?.printedWidth.status).toBe("set");
    expect(Number((panel?.dpi as { number: number }).number)).toBeGreaterThan(150);
    const [without] = rows(PANEL_STACK, { pattern: null });
    expect(without).toMatchObject({ result: "unknown" });
    expect(without?.sentence).toBe("How large this picture prints is not known until the pattern is in, so its resolution is not known.");
  });

  it("gives nothing for a stack with no picture", () => {
    expect(rows(GROUND_STACK)).toEqual([]);
    expect(rows(TILE_STACK).map((row) => row.layerId)).toEqual(["club-tile"]);
  });
});
