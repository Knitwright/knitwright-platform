import { describe, expect, it } from "vitest";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { writeDxf, writeDxfAllSizes } from "./dxf/write";
import { MEN_RUN, scalePiece, syntheticPieces } from "./fixtures/synthetic-set";
import { buildSet, MAX_SIZES, type PatternSet } from "./set";
import { orderSizes } from "./sizes";

const options = { styleName: "Test run" };
const oneFilePerSize = (size: (typeof MEN_RUN)[number]) => ({ name: `${size}.dxf`, text: writeDxf(syntheticPieces(size), options) });
const ok = (result: ReturnType<typeof buildSet>): PatternSet => {
  if (!result.ok) throw new Error(result.reasons.join(" | "));
  return result;
};

describe("a men's XS to 3XL set, one file per size", () => {
  const result = ok(buildSet({ files: MEN_RUN.map(oneFilePerSize), outline: "net" }));

  it("stores 7 sizes by 4 pieces in size order", () => {
    expect(result.sizes).toEqual([...MEN_RUN]);
    for (const size of MEN_RUN) expect(result.piecesBySize[size].map((p) => p.id)).toEqual(["front", "back", "sleeve", "collar"]);
  });

  it("measures every size, all 14 registry points that apply and the pattern-only points", () => {
    for (const size of MEN_RUN) {
      const ids = new Set(result.measurementsBySize[size].map((m) => m.pointId));
      expect(ids.size).toBeGreaterThanOrEqual(19);
      for (const id of ["chest-width", "cap-height", "armhole-curve", "across-back", "neckline-length"]) expect(ids.has(id)).toBe(true);
    }
  });

  it("grows measurements with the size", () => {
    const chest = (size: string) => result.measurementsBySize[size].find((m) => m.pointId === "chest-width")?.tenthsMm ?? 0;
    expect(chest("XS")).toBeLessThan(chest("M"));
    expect(chest("M")).toBeLessThan(chest("3XL"));
  });

  it("runs every check at every size, none refusing", () => {
    for (const size of MEN_RUN) expect(result.checks.filter((c) => c.size === size && c.level === "refuse").every((c) => c.ok)).toBe(true);
    expect(result.checks.filter((c) => c.id === "seam-side")).toHaveLength(7);
  });

  it("adds seam allowance and notches, and says so", () => {
    expect(result.derived.some((d) => d.includes("seam allowance added") && d.includes("Knitwright default"))).toBe(true);
    expect(result.derived.some((d) => d.includes("notches added"))).toBe(true);
    expect(result.questions).toEqual([]);
    expect(result.piecesBySize.M.every((p) => p.notches.length > 0 && p.sewLine !== null)).toBe(true);
  });
});

describe("the same run as one multi-size file", () => {
  it("gives the same pieces as the files one by one", () => {
    const pattern = { blockId: "x", blockVersion: 1, sizes: [...MEN_RUN], piecesBySize: Object.fromEntries(MEN_RUN.map((s) => [s, syntheticPieces(s)])) };
    const whole = ok(buildSet({ files: [{ name: "all.dxf", text: writeDxfAllSizes(pattern, options) }], outline: "gross" }));
    const parts = ok(buildSet({ files: MEN_RUN.map(oneFilePerSize), outline: "gross" }));
    expect(whole.piecesBySize).toEqual(parts.piecesBySize);
  });
});

describe("refusals", () => {
  it("refuses a set whose side seams differ by more than 2 mm and names the seam and the size", () => {
    const broken = syntheticPieces("M").map((p) => {
      if (p.id !== "back") return p;
      const moved = p.cutOutline.map((pt, i) => (i === 64 ? [pt[0] - 5, pt[1]] : pt));
      return { ...p, cutOutline: moved as typeof p.cutOutline, landmarks: { ...p.landmarks, "side-hem": moved[64] as [number, number] } };
    });
    const result = buildSet({ files: [{ name: "M.dxf", text: writeDxf(broken, options) }], outline: "gross" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.join(" ")).toMatch(/Side seams, size M: the front is .* and the back is .*apart/);
  });

  it("refuses a size missing a piece, an extra piece and a size given twice", () => {
    const m = syntheticPieces("M");
    const noSleeve = { name: "S.dxf", text: writeDxf(syntheticPieces("S").filter((p) => p.id !== "sleeve"), options) };
    const result = buildSet({ files: [{ name: "M.dxf", text: writeDxf(m, options) }, noSleeve], outline: "gross", sizeOrder: ["M", "S"] });
    expect(!result.ok && result.reasons).toEqual(["Size S has no sleeve, which size M has."]);
    const extra = buildSet({ files: [noSleeve, { name: "M.dxf", text: writeDxf(m, options) }], outline: "gross", sizeOrder: ["S", "M"] });
    expect(!extra.ok && extra.reasons).toEqual(["Size M has sleeve, which size S does not have."]);
    const twice = buildSet({ files: [oneFilePerSize("M"), oneFilePerSize("M")], outline: "gross" });
    expect(!twice.ok && twice.reasons[0]).toContain("more than once");
  });

  it("refuses an unreadable file by name, no files, no pieces and too many sizes", () => {
    const bad = buildSet({ files: [{ name: "x.dxf", text: "not a dxf" }] });
    expect(!bad.ok && bad.reasons[0]).toMatch(/^x\.dxf: /);
    expect(!buildSet({ files: [] }).ok).toBe(true);
    const empty = buildSet({ files: [{ name: "e.dxf", text: writeDxf([], options) }] });
    expect(!empty.ok && empty.reasons[0]).toBe("No pieces were found in the files.");
    const many = Array.from({ length: MAX_SIZES + 1 }, (_, i) => ({ name: `s${i}.dxf`, text: writeDxf(JERSEY_EU48.piecesBySize["48"].map((p) => scalePiece(p, `S${i}`, 1)), options) }));
    expect(!buildSet({ files: many, outline: "gross" }).ok).toBe(true);
  });
});

describe("the benchmark files themselves", () => {
  it("are accepted as one size, with the questions the library must ask", () => {
    const jersey = { name: "j.dxf", text: writeDxf(JERSEY_EU48.piecesBySize["48"], options) };
    const result = ok(buildSet({ files: [jersey] }));
    expect(result.sizes).toEqual(["48"]);
    expect(result.questions[0]).toContain("seam allowance");
    expect(result.checks.find((c) => c.id === "seam-allowance")?.ok).toBe(false);
  });

  it("take landmarks placed by hand", () => {
    const stripped = JERSEY_EU48.piecesBySize["48"].map((p) => (p.id === "front" ? { ...p, landmarks: {} } : p));
    const file = { name: "j.dxf", text: writeDxf(stripped, options) };
    const without = ok(buildSet({ files: [file] }));
    expect(without.checks.find((c) => c.id === "landmarks-front")?.ok).toBe(false);
    const placed = ok(buildSet({ files: [file], overrides: { "48/front": JERSEY_EU48.piecesBySize["48"][0].landmarks } }));
    expect(placed.checks.find((c) => c.id === "landmarks-front")?.ok).toBe(true);
  });
});

describe("orderSizes", () => {
  it("puts letters small to large, then numbers, then the rest", () => {
    expect(orderSizes(["XL", "46", "M", "weird", "XS", "44", "3XL", "2XL"])).toEqual(["XS", "M", "XL", "2XL", "3XL", "44", "46", "weird"]);
  });
  it("follows a preferred order first", () => {
    expect(orderSizes(["S", "M", "L"], ["L", "S"])).toEqual(["L", "S", "M"]);
  });
});
