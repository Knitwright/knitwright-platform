import { describe, expect, it } from "vitest";
import { gradedPatternSchema, type GradedPattern, type PatternPiece } from "@/lib/production/contract";
import { JERSEY_EU48, TEE_EU48 } from "@/lib/production/fixtures";
import { addNotches } from "../notches";
import { withSeamAllowance } from "../seam-allowance";
import { parseDxf } from "./parse";
import { readDxf } from "./read";
import { DRAFT_NOTICE, writeDxf, writeDxfAllSizes, writeDxfPerSize } from "./write";

const options = { styleName: "Round trip" };

/** The jersey with notches and allowance, the way the library stores a finished set. */
function finished(): PatternPiece[] {
  const grown = JERSEY_EU48.piecesBySize["48"].map((p) => {
    const r = withSeamAllowance(p, "net");
    if (!r.ok) throw new Error("asked");
    return r.piece;
  });
  return [...addNotches(grown).pieces];
}

describe("writeDxf", () => {
  it("is the same bytes every time", () => {
    expect(writeDxf(finished(), options)).toBe(writeDxf(finished(), options));
  });

  it("states units, review status and has no date", () => {
    const text = writeDxf(JERSEY_EU48.piecesBySize["48"], options);
    expect(text).toContain("$INSUNITS\n70\n4");
    expect(text).toContain(`STATUS: ${DRAFT_NOTICE}`);
    expect(text).not.toMatch(/CREATION (DATE|TIME)/);
    expect(writeDxf([], { ...options, status: "Reviewed by A. Tailor on 2026-10-20." })).toContain("Reviewed by A. Tailor");
  });

  it("round-trips the benchmark pieces to the hundredth of a millimetre", () => {
    for (const set of [JERSEY_EU48, TEE_EU48]) {
      const back = readDxf(writeDxf(set.piecesBySize["48"], options));
      expect(back.warnings).toEqual([]);
      expect(back.pieces).toEqual(set.piecesBySize["48"]);
    }
  });

  it("round-trips notches, sew line and allowance, and has layer 4 and 14 in the file", () => {
    const pieces = finished();
    const text = writeDxf(pieces, options);
    const layers = new Set(parseDxf(text).blocks.flatMap((b) => b.entities.map((e) => e.layer)));
    expect(["1", "2", "4", "5", "6", "7", "14"].every((l) => layers.has(l))).toBe(true);
    const back = readDxf(text);
    expect(back.warnings).toEqual([]);
    expect(back.pieces).toEqual(pieces);
    for (const piece of back.pieces) {
      expect(piece.grainLine).not.toBeNull();
      expect(piece.sewLine).not.toBeNull();
      expect(piece.notches.length).toBeGreaterThan(0);
    }
  });

  it("keeps a piece's own id when the name would give another", () => {
    const odd = { ...JERSEY_EU48.piecesBySize["48"][0], id: "body-panel", name: "Front Body" };
    expect(readDxf(writeDxf([odd], options)).pieces[0].id).toBe("body-panel");
  });

  it("keeps two pieces of one name and size apart", () => {
    const p = JERSEY_EU48.piecesBySize["48"][0];
    const text = writeDxf([p, { ...p, id: "front-2" }], options);
    expect(parseDxf(text).blocks.map((b) => b.name)).toEqual(["torso front_48", "torso front_48-2"]);
  });

  it("writes mirrored and unmirrored quantities the way the benchmark does", () => {
    const text = writeDxf(JERSEY_EU48.piecesBySize["48"], options);
    expect(text).toContain("QUANTITY: 1,0");
    expect(text).toContain("QUANTITY: 1,1");
  });

  it("keeps a line break in a name from starting a new line of the file", () => {
    const text = writeDxf(JERSEY_EU48.piecesBySize["48"], { styleName: "Club\n0\nSECTION" });
    expect(text).toContain("STYLE NAME: Club 0 SECTION");
    expect(readDxf(text).info.styleName).toBe("Club 0 SECTION");
  });

  it("never writes minus zero", () => {
    const p = { ...JERSEY_EU48.piecesBySize["48"][3], landmarks: {} };
    expect(writeDxf([p], options)).not.toContain("-0.00");
  });
});

describe("one file per size and one file for all", () => {
  const sizes = ["S", "M"];
  const pattern: GradedPattern = gradedPatternSchema.parse({
    blockId: "b", blockVersion: 1, sizes,
    piecesBySize: Object.fromEntries(sizes.map((s) => [s, JERSEY_EU48.piecesBySize["48"].map((p) => ({ ...p, sizeLabel: s }))])),
  });

  it("writes a file for each size that reads back as that size alone", () => {
    const files = writeDxfPerSize(pattern, options);
    expect(Object.keys(files)).toEqual(sizes);
    expect(readDxf(files.M).pieces.map((p) => p.sizeLabel)).toEqual(["M", "M", "M", "M"]);
  });

  it("writes every size into one file that reads back whole", () => {
    const back = readDxf(writeDxfAllSizes(pattern, options));
    expect(back.pieces).toHaveLength(8);
    expect(back.pieces.filter((p) => p.sizeLabel === "S")).toEqual(pattern.piecesBySize.S);
  });
});
