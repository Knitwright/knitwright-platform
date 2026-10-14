import { describe, expect, it } from "vitest";
import {
  NOT_SCALED_FOR_SHRINK,
  fabricValueSchema,
  gradedPatternSchema,
  patternMeasurementSchema,
  patternPieceSchema,
  printFileSpecSchema,
  printScale,
  readinessItemSchema,
  releaseSnapshotSchema,
  rosterRowSchema,
  seamAllowanceSchema,
  sizeLabelMapSchema,
  type FabricValue,
  type PatternPiece,
} from ".";

const tested = (value: number): FabricValue => ({ value, source: "fabric-test", testId: "t1" });
const NOT_SET: FabricValue = { value: null, source: "not-set" };

const piece: PatternPiece = {
  id: "front",
  name: "front",
  sizeLabel: "48",
  quantity: 1,
  mirroredPair: false,
  onFold: true,
  outlineKind: "unknown",
  cutOutline: [[0, 0], [10, 0], [10, 10]],
  sewLine: null,
  notches: [],
  seamAllowance: [],
  grainLine: { from: [0, 5], to: [10, 5] },
  foldLine: { from: [0, 0], to: [0, 10] },
  internalLines: [],
  landmarks: { hps: [1, 1] },
};

describe("the print scale for a fabric's shrink", () => {
  it("is 1 / (1 - shrink) on each axis, 1.0204 by 1.0152 for 2.0 % and 1.5 %", () => {
    const scale = printScale({ shrinkLengthPct: tested(2), shrinkWidthPct: tested(1.5) });
    expect(scale.length).toBeCloseTo(1.0204, 4);
    expect(scale.width).toBeCloseTo(1.0152, 4);
    expect(scale.notScaled).toBe(false);
    expect(scale.note).toBeNull();
  });

  it("is 1 with the margin note when there is no shrink test", () => {
    const scale = printScale({ shrinkLengthPct: NOT_SET, shrinkWidthPct: NOT_SET });
    expect(scale).toEqual({ length: 1, width: 1, notScaled: true, note: NOT_SCALED_FOR_SHRINK });
    expect(NOT_SCALED_FOR_SHRINK).toBe("Not scaled for shrink: this fabric has no shrink test.");
  });

  it("does not scale on a suggested value, and says so", () => {
    const scale = printScale({ shrinkLengthPct: { value: 3, source: "suggested" }, shrinkWidthPct: tested(1.5) });
    expect(scale.length).toBe(1);
    expect(scale.width).toBeCloseTo(1.0152, 4);
    expect(scale.notScaled).toBe(true);
  });

  it("scales on a supplier's sheet", () => {
    const sheet: FabricValue = { value: 4, source: "supplier-sheet" };
    expect(printScale({ shrinkLengthPct: sheet, shrinkWidthPct: sheet }).length).toBeCloseTo(1.0417, 4);
  });
});

describe("a fabric value", () => {
  it("is empty exactly when it is not set", () => {
    expect(fabricValueSchema.safeParse(NOT_SET).success).toBe(true);
    expect(fabricValueSchema.safeParse({ value: 2, source: "not-set" }).success).toBe(false);
    expect(fabricValueSchema.safeParse({ value: null, source: "fabric-test" }).success).toBe(false);
  });

  it("carries a test id only from a test", () => {
    expect(fabricValueSchema.safeParse({ value: 2, source: "suggested", testId: "t" }).success).toBe(false);
  });
});

describe("a pattern piece", () => {
  it("accepts a valid piece", () => {
    expect(patternPieceSchema.safeParse(piece).success).toBe(true);
  });

  it("refuses an outline of fewer than three points, an unknown landmark and a bad seam id", () => {
    expect(patternPieceSchema.safeParse({ ...piece, cutOutline: [[0, 0], [1, 1]] }).success).toBe(false);
    expect(patternPieceSchema.safeParse({ ...piece, landmarks: { nowhere: [0, 0] } }).success).toBe(false);
    expect(patternPieceSchema.safeParse({ ...piece, notches: [{ seamId: "Side Seam", at: [0, 0], count: 1 }] }).success).toBe(false);
  });

  it("needs a fold line when cut on the fold, and twos when a mirrored pair", () => {
    expect(patternPieceSchema.safeParse({ ...piece, foldLine: null }).success).toBe(false);
    expect(patternPieceSchema.safeParse({ ...piece, onFold: false, mirroredPair: true, quantity: 1 }).success).toBe(false);
    expect(patternPieceSchema.safeParse({ ...piece, onFold: false, mirroredPair: true, quantity: 2 }).success).toBe(true);
  });

  it("gives a seam allowance a size exactly when its source states one", () => {
    expect(seamAllowanceSchema.safeParse({ seamId: "hem", mm: 20, source: "knitwright-default" }).success).toBe(true);
    expect(seamAllowanceSchema.safeParse({ seamId: "hem", mm: null, source: "not-stated" }).success).toBe(true);
    expect(seamAllowanceSchema.safeParse({ seamId: "hem", mm: 20, source: "not-stated" }).success).toBe(false);
    expect(seamAllowanceSchema.safeParse({ seamId: "hem", mm: null, source: "pattern-file" }).success).toBe(false);
  });
});

describe("a graded pattern", () => {
  const graded = { blockId: "b", blockVersion: 1, sizes: ["48"], piecesBySize: { "48": [piece] } };

  it("accepts pieces listed under the size they carry", () => {
    expect(gradedPatternSchema.safeParse(graded).success).toBe(true);
  });

  it("refuses a size with no pieces, an extra size, and a piece under the wrong size", () => {
    expect(gradedPatternSchema.safeParse({ ...graded, sizes: ["48", "50"] }).success).toBe(false);
    expect(gradedPatternSchema.safeParse({ ...graded, sizes: [] }).success).toBe(false);
    expect(gradedPatternSchema.safeParse({ ...graded, piecesBySize: { "50": [piece] } }).success).toBe(false);
  });
});

describe("records of the rest of the contract", () => {
  it("measures from a pattern in whole tenths of a millimetre, with that source", () => {
    const m = { pointId: "chest", size: "48", tenthsMm: 507, source: "measured-from-pattern", method: "Straight line between the underarm points." };
    expect(patternMeasurementSchema.safeParse(m).success).toBe(true);
    expect(patternMeasurementSchema.safeParse({ ...m, tenthsMm: 50.7 }).success).toBe(false);
    expect(patternMeasurementSchema.safeParse({ ...m, source: "derived" }).success).toBe(false);
  });

  it("maps a size label to a pattern size", () => {
    expect(sizeLabelMapSchema.safeParse({ label: "M", wearer: "men", cut: "mens", patternSize: "48", source: "suggested" }).success).toBe(true);
    expect(sizeLabelMapSchema.safeParse({ label: "M", wearer: "men", cut: "mens", patternSize: "48", source: "measured" }).success).toBe(false);
  });

  it("keeps the digits of a shirt number as printed", () => {
    const row = { name: "OKAFOR", number: "07", sizeLabel: "M", cut: "mens", quantity: 1 };
    expect(rosterRowSchema.safeParse(row).success).toBe(true);
    expect(rosterRowSchema.safeParse({ ...row, number: "ten" }).success).toBe(false);
    expect(rosterRowSchema.safeParse({ ...row, quantity: 0 }).success).toBe(false);
  });

  it("describes a print file with the scale and profile it was built with", () => {
    const profile = { bleedMm: 15, dpi: 150, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" };
    const spec = { pieceId: "front", size: "48", format: "pdf", bleedMm: 15, scaleX: 1.0204, scaleY: 1.0152, dpi: 150, profile };
    expect(printFileSpecSchema.safeParse(spec).success).toBe(true);
    expect(printFileSpecSchema.safeParse({ ...spec, format: "png" }).success).toBe(false);
    expect(printFileSpecSchema.safeParse({ ...spec, scaleX: 0 }).success).toBe(false);
  });

  it("holds a release as a snapshot with a SHA-256 for each file", () => {
    const profile = { bleedMm: 15, dpi: 150, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" };
    const hash = "a".repeat(64);
    const snapshot = { specVersion: 3, patternBlockId: "b", patternBlockVersion: 1, fabricTestIds: [], printProfile: profile, rosterHash: null, files: [{ path: "print/front-48.pdf", sha256: hash }] };
    expect(releaseSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(releaseSnapshotSchema.safeParse({ ...snapshot, files: [{ path: "x", sha256: "abc" }] }).success).toBe(false);
  });

  it("names who acts on a readiness item", () => {
    const item = { id: "fabric-test", met: false, sentence: "Add a shrink test for the fabric.", whoActs: "print-house" };
    expect(readinessItemSchema.safeParse(item).success).toBe(true);
    expect(readinessItemSchema.safeParse({ ...item, whoActs: "nobody" }).success).toBe(false);
  });
});

describe("hardening", () => {
  it("does not scale on a shrink of 100 % or more", () => {
    const scale = printScale({ shrinkLengthPct: tested(100), shrinkWidthPct: tested(150) });
    expect(scale).toMatchObject({ length: 1, width: 1, notScaled: true });
  });

  it("refuses control characters in a roster name", () => {
    const row = { name: "OKAFOR", number: "7", sizeLabel: "48", cut: "mens", quantity: 1 };
    expect(rosterRowSchema.safeParse(row).success).toBe(true);
    expect(rosterRowSchema.safeParse({ ...row, name: "A\u0000B" }).success).toBe(false);
    expect(rosterRowSchema.safeParse({ ...row, name: "A\nB" }).success).toBe(false);
  });

  it("refuses a release file path that leaves the release", () => {
    const file = (path: string) => releaseSnapshotSchema.shape.files.element.safeParse({ path, sha256: "a".repeat(64) }).success;
    expect(file("print/front-48.pdf")).toBe(true);
    for (const bad of ["../x.pdf", "/etc/x", "a//b", "./a"]) expect(file(bad)).toBe(false);
  });

  it("does not take a size name from the object prototype", () => {
    const result = gradedPatternSchema.safeParse({ blockId: "b", blockVersion: 1, sizes: ["toString"], piecesBySize: { other: [{ ...piece, sizeLabel: "other" }] } });
    expect(result.success).toBe(false);
  });
});
