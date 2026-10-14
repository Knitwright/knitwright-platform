import { describe, expect, it } from "vitest";
import type { PatternPiece, Point } from "../contract";
import { JERSEY_EU48, POLKA_JERSEY_DESIGN, ROSTER_22, TEE_EU48 } from ".";

const piece = (set: typeof JERSEY_EU48, id: string): PatternPiece => {
  const found = set.piecesBySize["48"].find((p) => p.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lm = (p: PatternPiece, id: keyof PatternPiece["landmarks"]): Point => {
  const point = p.landmarks[id];
  if (!point) throw new Error(`no landmark ${id}`);
  return point;
};
const cm = (mm: number): number => mm / 10;

describe.each([
  ["jersey", JERSEY_EU48],
  ["tee", TEE_EU48],
])("the benchmark %s pieces", (_name, set) => {
  it("are the four DXF pieces at size 48, with nothing the file does not state", () => {
    const pieces = set.piecesBySize["48"];
    expect(pieces.map((p) => p.id)).toEqual(["front", "back", "sleeve", "collar"]);
    for (const p of pieces) {
      expect(p.outlineKind).toBe("unknown");
      expect(p.notches).toEqual([]);
      expect(p.seamAllowance).toEqual([]);
      expect(p.sewLine).toBeNull();
      expect(p.grainLine).not.toBeNull();
    }
  });

  it("cut the sleeve as a pair and the others on the fold", () => {
    expect(piece(set, "sleeve")).toMatchObject({ quantity: 2, mirroredPair: true, onFold: false });
    for (const id of ["front", "back", "collar"]) expect(piece(set, id)).toMatchObject({ quantity: 1, onFold: true });
  });

  it("give the measurements of the plan's section 1 within 1 mm", () => {
    const front = piece(set, "front");
    const back = piece(set, "back");
    const sleeve = piece(set, "sleeve");
    expect(cm(lm(front, "hps")[0] - lm(front, "cf-hem")[0])).toBeCloseTo(set === JERSEY_EU48 ? 72.0 : 68.7, 1);
    expect(cm(dist(lm(front, "shoulder-point"), lm(front, "hps")))).toBeCloseTo(set === JERSEY_EU48 ? 10.6 : 10.4, 1);
    expect(cm(lm(front, "hps")[0] - lm(front, "cf-neck")[0])).toBeCloseTo(set === JERSEY_EU48 ? 9.6 : 9.8, 1);
    expect(cm(lm(back, "cb-neck")[0] * -1 + lm(back, "hps")[0])).toBeCloseTo(set === JERSEY_EU48 ? 2.6 : 2.7, 1);
    expect(cm(lm(front, "underarm")[1] * 2)).toBeCloseTo(50.7, 1);
    expect(cm(lm(front, "side-hem")[1] * 2)).toBeCloseTo(51.9, 1);
    expect(cm(lm(sleeve, "cap-top")[0] - lm(sleeve, "hem-a")[0])).toBeCloseTo(20.5, 1);
    expect(cm(lm(sleeve, "cap-top")[0] - lm(sleeve, "underarm-a")[0])).toBeCloseTo(13.8, 1);
    expect(cm(dist(lm(sleeve, "underarm-a"), lm(sleeve, "underarm-b")))).toBeCloseTo(37.2, 1);
    expect(cm(dist(lm(sleeve, "hem-a"), lm(sleeve, "hem-b")) / 2)).toBeCloseTo(17.3, 1);
  });
});

describe("the sample design and roster", () => {
  it("expresses the benchmark dots: 3 cm, 7 cm pitch, 3.5 cm rows, half drop", () => {
    expect(POLKA_JERSEY_DESIGN.kitPattern).toMatchObject({ diameterMm: 30, pitchMm: 70, rowStepMm: 35, halfDrop: true });
    expect(POLKA_JERSEY_DESIGN.colours.map((c) => c.id)).toEqual(["C1", "C2", "C3", "C4"]);
  });

  it("is 22 players with distinct numbers and a 14-letter name", () => {
    expect(ROSTER_22.rows).toHaveLength(22);
    expect(new Set(ROSTER_22.rows.map((r) => r.number)).size).toBe(22);
    expect(Math.max(...ROSTER_22.rows.map((r) => r.name.length))).toBe(14);
  });
});
