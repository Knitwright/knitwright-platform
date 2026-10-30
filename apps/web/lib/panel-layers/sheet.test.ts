import { describe, expect, it } from "vitest";
import type { PatternPiece, Point } from "@/lib/production/contract";
import { outlineArea } from "@/lib/production/geometry/offset";
import { boundsOf, patternSheet, rulerTicks, RING_KINDS } from "./sheet";
import { GRID_MM, SCALE_BAR_MM, sheetRules, SHEET_RULE_IDS } from "./sheet-rules";
import { ruleIdsOf, sheetFor } from "./view-2d";

const box = (w: number, h: number, dx = 0, dy = 0): Point[] => [
  [dx, dy],
  [dx + w, dy],
  [dx + w, dy + h],
  [dx, dy + h],
];

const piece = (over: Partial<PatternPiece> = {}): PatternPiece => ({
  id: "front",
  name: "Front",
  sizeLabel: "M",
  quantity: 1,
  mirroredPair: false,
  onFold: true,
  outlineKind: "with-seam-allowance",
  cutOutline: box(500, 700),
  sewLine: box(490, 690, 5, 5),
  notches: [{ seamId: "side-seam", at: [500, 350], count: 1 }],
  seamAllowance: [{ seamId: "side-seam", mm: 10, source: "pattern-file" }],
  grainLine: { from: [250, 20], to: [250, 680] },
  foldLine: { from: [0, 0], to: [0, 700] },
  internalLines: [],
  landmarks: { hps: [100, 10] },
  ...over,
});

describe("patternSheet", () => {
  const sheet = patternSheet([piece()]);

  it("draws bleed, cut, sew and safe zone, outermost first", () => {
    expect(sheet.pieces[0]?.rings.map((ring) => ring.kind)).toEqual([...RING_KINDS]);
  });

  it("puts the bleed outside the cut line and the safe zone inside the sew line", () => {
    const area = (kind: string): number => outlineArea(sheet.pieces[0]?.rings.find((ring) => ring.kind === kind)?.points ?? []);
    expect(area("bleed")).toBeGreaterThan(area("cut"));
    expect(area("cut")).toBeGreaterThan(area("sew"));
    expect(area("sew")).toBeGreaterThan(area("safe"));
  });

  it("offsets the bleed by exactly the rule's distance", () => {
    const bleed = boundsOf(sheet.pieces[0]?.rings.find((ring) => ring.kind === "bleed")?.points ?? []);
    expect(bleed.minX).toBeCloseTo(-sheetRules().bleed.mm, 1);
    expect(bleed.maxX).toBeCloseTo(500 + sheetRules().bleed.mm, 1);
  });

  it("gives every line a rule id, and the grid and scale bar their own", () => {
    expect(ruleIdsOf(sheet)).toEqual(expect.arrayContaining([SHEET_RULE_IDS.bleed, SHEET_RULE_IDS.safeZone, SHEET_RULE_IDS.grid]));
    expect(sheet.pieces[0]?.rings.every((ring) => /^R-[A-Z]+-\d{3}$/.test(ring.ruleId))).toBe(true);
  });

  it("keeps the grain line, the fold line and the notches the pattern states", () => {
    expect(sheet.pieces[0]?.grainLine).toEqual({ from: [250, 20], to: [250, 680] });
    expect(sheet.pieces[0]?.notches).toEqual([[500, 350]]);
  });

  it("pads the bounds by one grid square beyond the outermost line", () => {
    expect(sheet.boundsMm.minY).toBeCloseTo(-sheetRules().bleed.mm - GRID_MM, 1);
  });

  it("says when a piece has no sew line, and measures the safe zone from the cut line instead", () => {
    const bare = patternSheet([piece({ sewLine: null })]);
    expect(bare.notes).toEqual(["Front has no sew line on file, so the safe zone is measured from the cut line instead."]);
    expect(bare.pieces[0]?.rings.map((ring) => ring.kind)).toEqual(["bleed", "cut", "safe"]);
  });

  it("leaves out a safe zone that the piece is too small to hold, rather than drawing a line of no area", () => {
    const tiny = patternSheet([piece({ cutOutline: box(8, 8), sewLine: null, foldLine: { from: [0, 0], to: [0, 8] } })]);
    expect(tiny.pieces[0]?.rings.map((ring) => ring.kind)).toEqual(["bleed", "cut"]);
  });

  it("holds several pieces and bounds them all", () => {
    const two = patternSheet([piece(), piece({ id: "back", name: "Back", cutOutline: box(500, 700, 600, 0), sewLine: null, foldLine: { from: [600, 0], to: [600, 700] } })]);
    expect(two.pieces).toHaveLength(2);
    expect(two.boundsMm.maxX).toBeGreaterThan(1100);
  });

  it("has no pieces and an empty box for an empty pattern", () => {
    const none = patternSheet([]);
    expect(none.pieces).toEqual([]);
    expect(none.boundsMm).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    expect(none.rulerX).toEqual([]);
  });
});

describe("boundsOf", () => {
  it("is the empty box for no points", () => {
    expect(boundsOf([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  it("rounds to 0.01 mm", () => {
    expect(boundsOf([[1.234, 2.345]])).toEqual({ minX: 1.23, minY: 2.35, maxX: 1.23, maxY: 2.35 });
  });
});

describe("rulerTicks", () => {
  it("marks every grid step and labels every scale-bar length", () => {
    const ticks = rulerTicks(0, 200, GRID_MM, SCALE_BAR_MM);
    expect(ticks).toHaveLength(21);
    expect(ticks.filter((tick) => tick.major).map((tick) => tick.label)).toEqual(["0 mm", "100 mm", "200 mm"]);
  });

  it("starts at the first step inside the span, so a padded box does not mark off its edge", () => {
    expect(rulerTicks(-15, 25, GRID_MM, SCALE_BAR_MM).map((tick) => tick.mm)).toEqual([-10, 0, 10, 20]);
  });

  it("is empty for a span of no width or a step of none", () => {
    expect(rulerTicks(5, 5, GRID_MM, SCALE_BAR_MM)).toEqual([]);
    expect(rulerTicks(0, 100, 0, SCALE_BAR_MM)).toEqual([]);
    expect(rulerTicks(0, 100, GRID_MM, 0)).toEqual([]);
  });
});

describe("sheetFor", () => {
  it("draws a drafted size", () => {
    const view = sheetFor({ kind: "drafted", draft: { pieces: [] } as never, pieces: [piece()] });
    expect(view.kind).toBe("sheet");
  });

  it("says why there is nothing, in the drafter's own words", () => {
    const view = sheetFor({ kind: "not-drafted-yet", reason: "JSY-SS-02 has no drafting script yet.", ruleId: "R-GAP-000" });
    expect(view).toEqual({ kind: "nothing", reason: "JSY-SS-02 has no drafting script yet.", ruleId: "R-GAP-000" });
  });

  it("lists the drafter's findings for a form the article does not offer", () => {
    const view = sheetFor({ kind: "invalid", findings: [{ message: "Body length is outside the approved range." } as never] });
    expect(view).toEqual({ kind: "invalid", reasons: ["Body length is outside the approved range."] });
  });

  it("says so for a design with no base article, and for a draft with no pieces", () => {
    expect(sheetFor(null)).toMatchObject({ kind: "nothing", ruleId: null });
    expect(sheetFor({ kind: "drafted", draft: { pieces: [] } as never, pieces: [] })).toMatchObject({ kind: "nothing" });
  });
});
