import { describe, expect, it } from "vitest";
import { JERSEY_EU48, TEE_EU48 } from "@/lib/production/fixtures";
import type { PatternPiece } from "@/lib/production/contract";
import { cutList, totalAreaCm2 } from "./cut-list";

const jersey = JERSEY_EU48.piecesBySize["48"]!;

describe("cutList for the benchmark jersey at EU 48", () => {
  const rows = cutList(jersey, { assign: { collar: "rib" } });
  const byId = Object.fromEntries(rows.map((r) => [r.pieceId, r]));

  it("has the four piece types the pattern has", () => {
    expect(rows.map((r) => r.pieceId)).toEqual(["front", "back", "sleeve", "collar"]);
  });

  it("gives the quantities, fold and mirror as the pattern states them", () => {
    expect(byId.front).toMatchObject({ quantity: 1, onFold: true, mirroredPair: false });
    expect(byId.back).toMatchObject({ quantity: 1, onFold: true, mirroredPair: false });
    expect(byId.sleeve).toMatchObject({ quantity: 2, onFold: false, mirroredPair: true });
    expect(byId.collar).toMatchObject({ quantity: 1, onFold: true });
  });

  it("names the fabric each piece is cut from, main unless told otherwise", () => {
    expect(byId.front?.fabricId).toBe("main");
    expect(byId.collar?.fabricId).toBe("rib");
  });

  it("measures the whole piece, so a half cut on the fold counts twice its drawn area", () => {
    const front = jersey.find((p) => p.id === "front")!;
    const half = Math.abs(
      front.cutOutline.reduce((s, [x1, y1], i) => {
        const [x2, y2] = front.cutOutline[(i + 1) % front.cutOutline.length]!;
        return s + x1 * y2 - x2 * y1;
      }, 0),
    ) / 2 / 100;
    expect(byId.front?.areaCm2).toBeCloseTo(half * 2, 1);
    expect(byId.front!.areaCm2).toBeGreaterThan(2500);
    expect(byId.front!.areaCm2).toBeLessThan(4000);
  });

  it("multiplies by the quantity for the total", () => {
    expect(byId.sleeve?.totalAreaCm2).toBeCloseTo(byId.sleeve!.areaCm2 * 2, 5);
  });

  it("says a grain line is present and at what angle, and counts notches actually drawn", () => {
    expect(byId.front?.grain).toEqual({ stated: true, angleDeg: 0 });
    expect(byId.front?.notchMarks).toBe(0);
  });

  it("says the file does not state whether the outline holds seam allowance", () => {
    expect(byId.front?.outlineNote).toMatch(/does not say/i);
  });
});

describe("cutList edge cases", () => {
  const base = TEE_EU48.piecesBySize["48"]![0]!;
  const piece = (over: Partial<PatternPiece>): PatternPiece => ({ ...base, ...over });

  it("counts notch marks, one or two or three per notch", () => {
    const rows = cutList([piece({ notches: [{ seamId: "shoulder", at: [0, 0], count: 2 }, { seamId: "side", at: [1, 1], count: 1 }] })]);
    expect(rows[0]?.notchMarks).toBe(3);
  });

  it("reports no grain line when the piece has none", () => {
    const rows = cutList([piece({ grainLine: null })]);
    expect(rows[0]?.grain).toEqual({ stated: false, angleDeg: null });
  });

  it("describes each outline kind", () => {
    expect(cutList([piece({ outlineKind: "with-seam-allowance" })])[0]?.outlineNote).toMatch(/includes/i);
    expect(cutList([piece({ outlineKind: "without-seam-allowance" })])[0]?.outlineNote).toMatch(/add the seam allowance/i);
  });

  it("is the same every time", () => {
    expect(cutList(jersey)).toEqual(cutList(jersey));
  });

  it("does not change the pieces it is given", () => {
    const copy = structuredClone(jersey);
    cutList(jersey);
    expect(jersey).toEqual(copy);
  });

  it("adds up area for a fabric", () => {
    const rows = cutList(jersey, { assign: { collar: "rib" } });
    expect(totalAreaCm2(rows, "rib")).toBeCloseTo(rows[3]!.totalAreaCm2, 5);
    expect(totalAreaCm2(rows, "main")).toBeCloseTo(rows[0]!.totalAreaCm2 + rows[1]!.totalAreaCm2 + rows[2]!.totalAreaCm2, 5);
    expect(totalAreaCm2(rows, "nothing")).toBe(0);
  });
});
