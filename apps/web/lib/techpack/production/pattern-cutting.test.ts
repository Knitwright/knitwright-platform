import { describe, expect, it } from "vitest";
import type { FabricProfile, PatternPiece } from "@/lib/production/contract";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { benchmarkJerseyInput, completePiece, gradedJersey } from "../fixtures/production";
import { buildPatternAndCutting, DRAFT_PATTERN, NO_PATTERN } from "./pattern-cutting";

const NOT_SET = { value: null, source: "not-set" } as const;
const FABRIC: FabricProfile = {
  stretchLengthPct: NOT_SET,
  stretchWidthPct: NOT_SET,
  recoveryPct: NOT_SET,
  shrinkLengthPct: NOT_SET,
  shrinkWidthPct: NOT_SET,
  gsm: NOT_SET,
  usableWidthMm: { value: 1500, source: "supplier-sheet" },
};

const rect: PatternPiece = {
  ...JERSEY_EU48.piecesBySize["48"]![0]!,
  cutOutline: [[0, 0], [500, 0], [500, 400], [0, 400]],
  grainLine: { from: [0, 0], to: [300, 0] },
};
const oneSquare = { ...JERSEY_EU48, sizes: ["48"], piecesBySize: { "48": [rect] } };

const section = (overrides: Partial<Parameters<typeof buildPatternAndCutting>[0]> = {}) =>
  buildPatternAndCutting({ pattern: benchmarkJerseyInput().pattern, review: null, fabric: null, marker: null, ...overrides });

describe("the pattern and cutting section", () => {
  it("says there is no pattern yet and lists nothing", () => {
    const empty = section({ pattern: null });
    expect(empty.note).toBe(NO_PATTERN);
    expect(empty.cutList).toEqual([]);
    expect(empty.reviewStatus).toMatchObject({ value: DRAFT_PATTERN });
    expect(empty.blockName).toBeNull();
  });

  it("lists every piece of every size with how it is cut", () => {
    const graded = section({ pattern: gradedJersey(true) });
    expect(graded.cutList).toHaveLength(12);
    expect(graded.blockName).toBe("benchmark-jersey-1598, version 1");
    const front = section().cutList.find((row) => row.pieceId === "front");
    expect(front?.cut).toMatchObject({ value: "Cut 1 on the fold", provenance: "measured-from-pattern" });
    expect(section().cutList.find((row) => row.pieceId === "sleeve")?.cut).toMatchObject({ value: "Cut 2, a left and a right" });
    expect(section().cutList.find((row) => row.pieceId === "sleeve")?.quantity).toMatchObject({ number: 2, value: "2 pieces" });
    expect(section().cutList.find((row) => row.pieceId === "front")?.quantity).toMatchObject({ value: "1 piece" });
  });

  it("gives the area of everything cut, counting the fold twice", () => {
    expect(section({ pattern: oneSquare }).cutList[0]?.area).toMatchObject({ number: 4000, value: "4000 cm²" });
  });

  it("states the grain line, the outline and the notches the pattern really has", () => {
    const row = section({ pattern: oneSquare }).cutList[0];
    expect(row?.grain).toMatchObject({ value: "Grain line drawn, 30.0 cm long" });
    const front = section().cutList.find((entry) => entry.pieceId === "front");
    expect(front?.outline).toMatchObject({ value: "The outline is the sewing line, without seam allowance" });
    expect(front?.notches).toMatchObject({ value: "4 notches on shoulder, side-seam, armhole and neck" });
  });

  it("leaves what a pattern file does not say to be confirmed", () => {
    const raw = buildPatternAndCutting({ pattern: JERSEY_EU48, review: null, fabric: null, marker: null });
    const front = raw.cutList.find((entry) => entry.pieceId === "front");
    expect(front?.outline).toEqual({ status: "to-be-confirmed" });
    expect(front?.notches).toMatchObject({ value: "No notches in the pattern" });
    expect(raw.seamAllowances).toEqual([]);
    const noGrain = buildPatternAndCutting({ pattern: { ...oneSquare, piecesBySize: { "48": [{ ...rect, grainLine: null }] } }, review: null, fabric: null, marker: null });
    expect(noGrain.cutList[0]?.grain).toEqual({ status: "to-be-confirmed" });
    const withAllowance = { ...completePiece(rect), outlineKind: "with-seam-allowance" as const };
    expect(buildPatternAndCutting({ pattern: { ...oneSquare, piecesBySize: { "48": [withAllowance] } }, review: null, fabric: null, marker: null }).cutList[0]?.outline).toMatchObject({
      value: "The outline includes the seam allowance",
    });
  });

  it("lists the seam allowance on each edge with where it came from", () => {
    const piece: PatternPiece = {
      ...rect,
      seamAllowance: [
        { seamId: "side-seam", mm: 6, source: "pattern-file" },
        { seamId: "hem", mm: 20, source: "knitwright-default" },
        { seamId: "neck", mm: null, source: "not-stated" },
      ],
    };
    const rows = buildPatternAndCutting({ pattern: { ...oneSquare, piecesBySize: { "48": [piece] } }, review: null, fabric: null, marker: null }).seamAllowances;
    expect(rows.map((row) => [row.seamId, row.allowance, row.sourceNote])).toEqual([
      ["side-seam", expect.objectContaining({ value: "0.6", tenthsMm: 60, provenance: "measured-from-pattern" }), "From the pattern file"],
      ["hem", expect.objectContaining({ value: "2.0", provenance: "derived" }), "Knitwright default, not from your pattern file"],
      ["neck", { status: "to-be-confirmed" }, "The pattern file does not state it"],
    ]);
  });

  it("works out fabric use from the usable width and a labelled default efficiency", () => {
    const use = section({ pattern: oneSquare, fabric: FABRIC });
    expect(use.fabricUse[0]).toMatchObject({ size: "48", length: { number: 0.33, value: "0.33 m", provenance: "derived" } });
    expect(use.fabricUse[0]?.note).toBe("Pieces fitted at 80 % efficiency (Knitwright default, not from your factory).");
    expect(use.fabricUseNote).toContain("80 % (Knitwright default, not from your factory)");
  });

  it("uses the factory's own marker efficiency when it gives one", () => {
    const fromFactory = section({ pattern: oneSquare, fabric: FABRIC, marker: { efficiencyPct: 90, source: "factory" } });
    expect(fromFactory.fabricUse[0]?.length).toMatchObject({ number: 0.3 });
    expect(fromFactory.fabricUse[0]?.note).toContain("from your factory");
    expect(section({ pattern: oneSquare, fabric: FABRIC, marker: { efficiencyPct: 90, source: "marker" } }).fabricUse[0]?.note).toContain("from the factory's marker");
  });

  it("gives only the area when the fabric has no usable width", () => {
    for (const fabric of [null, { ...FABRIC, usableWidthMm: NOT_SET }]) {
      const use = section({ pattern: oneSquare, fabric });
      expect(use.fabricUse[0]?.length).toEqual({ status: "to-be-confirmed" });
      expect(use.fabricUse[0]?.note).toBe("Needs the usable fabric width.");
      expect(use.fabricUseNote).toMatch(/^Fabric use needs the usable width/);
    }
  });

  it("says who reviewed the pattern, and keeps the draft note until someone has", () => {
    expect(section().note).toBe(DRAFT_PATTERN);
    const reviewed = section({ review: { name: "Ana Reyes", date: "3 Oct 2026", dateIso: "2026-10-03", blockVersion: 1, note: null } });
    expect(reviewed.reviewStatus).toMatchObject({ value: "Reviewed by Ana Reyes on 3 Oct 2026", provenance: "user-edited" });
    expect(reviewed.note).toBeNull();
  });
});
