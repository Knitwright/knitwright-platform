import { describe, expect, it } from "vitest";
import type { PatternPiece, Point } from "@/lib/production/contract";
import { patternSheet, type SheetPiece } from "./sheet";
import { gridStep, heightFor, pieceSummary, scaleBarPx, tickAt, zoomFor } from "./sheet-view";

const box = (w: number, h: number): Point[] => [
  [0, 0],
  [w, 0],
  [w, h],
  [0, h],
];

const piece = (over: Partial<PatternPiece> = {}): PatternPiece => ({
  id: "front",
  name: "Front",
  sizeLabel: "M",
  quantity: 1,
  mirroredPair: false,
  onFold: false,
  outlineKind: "with-seam-allowance",
  cutOutline: box(500, 700),
  sewLine: box(490, 690),
  notches: [],
  seamAllowance: [],
  grainLine: null,
  foldLine: null,
  internalLines: [],
  landmarks: {},
  ...over,
});

const sheet = () => patternSheet([piece()]);

describe("putting millimetres on a screen", () => {
  it("fits the sheet's width to the canvas", () => {
    const bounds = sheet().boundsMm;
    expect(zoomFor(bounds, 520)).toBeCloseTo(520 / (bounds.maxX - bounds.minX), 5);
    expect(heightFor(bounds, 520)).toBeGreaterThan(520);
  });

  it("draws one to one when there is nothing to fit, rather than dividing by zero", () => {
    expect(zoomFor({ minX: 0, minY: 0, maxX: 0, maxY: 0 }, 400)).toBe(1);
    expect(zoomFor({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 0)).toBe(1);
    expect(heightFor({ minX: 0, minY: 0, maxX: 0, maxY: 0 }, 400)).toBe(1);
  });

  it("puts a ruler mark at its own distance from the edge", () => {
    expect(tickAt({ mm: 100, major: true, label: "100 mm" }, 0, 2)).toBe(200);
    expect(tickAt({ mm: 0, major: true, label: "0 mm" }, -20, 2)).toBe(40);
  });

  it("leaves the grid off when its dots would be closer than four pixels", () => {
    expect(gridStep(sheet(), 1000)).toBeGreaterThan(4);
    expect(gridStep(sheet(), 40)).toBeNull();
  });

  it("makes the scale bar its own length at the drawing's own zoom", () => {
    const made = sheet();
    expect(scaleBarPx(made, 520)).toBeCloseTo(100 * zoomFor(made.boundsMm, 520), 1);
  });
});

describe("a piece in words, for the keyboard path", () => {
  const first = (): SheetPiece => {
    const found = sheet().pieces[0];
    if (found === undefined) throw new Error("The sheet has no pieces.");
    return found;
  };

  it("names the piece, its size, its measured box and the lines drawn on it", () => {
    expect(pieceSummary(first())).toBe("Front, size M. 500 by 700 mm. Lines drawn: bleed, cut, sew, safe.");
  });

  it("says when a piece has no outline on file", () => {
    expect(pieceSummary({ ...first(), rings: [] })).toMatch(/no outline on file/);
  });
});
