import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseDxf } from "@/lib/pattern-library/dxf/parse";
import { BUNDLED_ARTICLES, draftAllSizes, productionDxf, reviewPack, toGradedPattern, type ArticleDefinition, type ArticleDraft } from "./index";
import { len } from "./geometry";
import { DXF_LAYERS, nestDxf, nestLayout, patternReport } from "./review";
import { sizeColour } from "./review/nest";

const JSY = BUNDLED_ARTICLES.get("JSY-SS-01") as ArticleDefinition;
const graded = draftAllSizes("JSY-SS-01");
const drafts: readonly ArticleDraft[] = graded.kind === "drafted" ? graded.drafts : [];
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

describe("the review pack", () => {
  it("names a DXF and an SVG per size, the nest in both, and the report", () => {
    const pack = reviewPack("JSY-SS-01");
    expect(pack.kind === "drafted" && Object.keys(pack.files)).toEqual([
      ...JSY.sizes.flatMap((s) => [`JSY-SS-01_${s}.dxf`, `JSY-SS-01_${s}.svg`]),
      "JSY-SS-01_nest.svg",
      "JSY-SS-01_nest.dxf",
      "pattern-report.md",
    ]);
  });

  it("gives the same bytes twice, nest included", () => {
    const first = reviewPack("JSY-SS-01", { parameters: { body_length_offset: 20 } });
    const second = reviewPack("JSY-SS-01", { parameters: { body_length_offset: 20 } });
    expect(first.kind).toBe("drafted");
    expect(first).toEqual(second);
    const files = (pack: typeof first) => (pack.kind === "drafted" ? pack.files : {});
    expect(sha(files(first)["JSY-SS-01_nest.dxf"])).toBe(sha(files(second)["JSY-SS-01_nest.dxf"]));
    expect(files(first)["JSY-SS-01_nest.dxf"]).toMatch(/^0\nSECTION\n/);
  });

  it("passes on the reason when the request cannot be drafted", () => {
    expect(reviewPack("SHO-TR-01").kind).toBe("not-drafted-yet");
    expect(reviewPack("JSY-SS-01", { options: { collar: "C02" } }).kind).toBe("not-drafted-yet");
  });

  it("stacks every size of every piece in the nest DXF, on the cut layer, named on the text layer", () => {
    const doc = parseDxf(nestDxf(nestLayout(drafts, "M")));
    const outlines = doc.entities.filter((e) => e.type === "POLYLINE");
    expect(outlines).toHaveLength(4 * JSY.sizes.length);
    expect(new Set(outlines.map((e) => e.layer))).toEqual(new Set([DXF_LAYERS.cut]));
    const names = doc.entities.filter((e) => e.type === "TEXT").map((e) => e.pairs.find((p) => p[0] === 1)?.[1]);
    expect(names).toEqual(["FRONT", "BACK", "SLEEVE", "NECK RIB C01"].map((n) => `${n} XS S M L XL 2XL 3XL`));
  });

  it("draws an unlisted size in black", () => {
    expect(sizeColour("4XL")).toBe("#000000");
    expect(sizeColour("M")).toBe("#000000");
    expect(sizeColour("XS")).toBe("#7b3294");
  });
});

describe("the pattern report", () => {
  it("says which parameters the pattern was drafted with", () => {
    const outcome = draftAllSizes("JSY-SS-01", { parameters: { sleeve_length_offset: 30 } });
    const report = outcome.kind === "drafted" ? patternReport(JSY, outcome.drafts) : "";
    expect(report).toContain("Drafted with sleeve_length_offset 30 mm.");
    expect(report).toContain("| D sleeve length | 220 OK | 230 OK | 240 OK |");
  });

  it("marks a measurement that misses its POM, with the target", () => {
    const off = { ...drafts[0], checks: [{ label: "A chest half", target: 460, actual: 461.2 }] };
    expect(patternReport(JSY, [off])).toContain("| A chest half | 461.2 CHECK (target 460) |");
  });
});

describe("the production contract", () => {
  const pattern = toGradedPattern(drafts, 1);

  it("is a valid graded pattern of every size", () => {
    expect(pattern.blockId).toBe("JSY-SS-01");
    expect(pattern.sizes).toEqual(JSY.sizes);
    const m = pattern.piecesBySize.M;
    expect(m.map((p) => [p.id, p.quantity, p.mirroredPair, p.onFold])).toEqual([
      ["front", 1, false, false],
      ["back", 1, false, false],
      ["sleeve", 2, true, false],
      ["neck-rib", 1, false, false],
    ]);
  });

  it("is in the DXF frame, y up, with landmarks, notches and allowances from the draft", () => {
    const front = pattern.piecesBySize.M[0];
    expect(front.landmarks.hps).toEqual([90, 0]);
    expect(front.landmarks["cf-hem"]).toEqual([0, -720]);
    expect(front.landmarks["shoulder-point"]).toEqual([230, -45]);
    expect(front.notches.filter((n) => n.seamId === "armhole")).toHaveLength(2);
    expect(pattern.piecesBySize.M[1].notches.filter((n) => n.seamId === "armhole")).toHaveLength(4);
    expect(front.seamAllowance).toEqual([
      { seamId: "neckline", mm: 6, source: "knitwright-default" },
      { seamId: "shoulder-seam", mm: 6, source: "knitwright-default" },
      { seamId: "armhole", mm: 6, source: "knitwright-default" },
      { seamId: "side-seam", mm: 6, source: "knitwright-default" },
      { seamId: "body-hem", mm: 25, source: "knitwright-default" },
    ]);
    expect(front.grainLine?.from[1]).toBeGreaterThan(front.grainLine?.to[1] ?? 0);
    const rib = pattern.piecesBySize.M[3];
    expect(rib.grainLine?.from[0]).toBeCloseTo(-6 + 30, 9);
  });

  it("writes through the pattern library's DXF writer, the same bytes twice", () => {
    const first = productionDxf(pattern);
    expect(Object.keys(first.perSize)).toEqual(JSY.sizes);
    expect(first.allSizes).toContain("STYLE NAME: JSY-SS-01");
    expect(productionDxf(toGradedPattern(drafts, 1))).toEqual(first);
  });
});

/**
 * The Phase 0 test matrix of `docs/spec/04-production-package.md`: closed piece outlines, seam
 * lengths within 0.5 mm of the drafted geometry, and the spec's layers (1 cut, 14 sew, 7 grain,
 * 4 notch, 13 drill, 15 text). This article has no drill holes, so layer 13 stays empty.
 */
describe("the production DXF against the spec's test matrix", () => {
  const perSize = productionDxf(toGradedPattern(drafts, 1)).perSize;

  it.each(JSY.sizes)("size %s has one closed block per piece, each within 0.5 mm of the draft", (size) => {
    const doc = parseDxf(perSize[size]);
    const draft = drafts.find((d) => d.size === size) as ArticleDraft;
    expect(doc.blocks.map((b) => b.name)).toEqual(draft.pieces.map((p) => `${p.label}_${size}`));
    expect(doc.header.$INSUNITS).toBe("4");
    doc.blocks.forEach((block, i) => {
      const cut = block.entities.find((e) => e.type === "POLYLINE" && e.layer === DXF_LAYERS.cut);
      const sew = block.entities.find((e) => e.type === "POLYLINE" && e.layer === DXF_LAYERS.sew);
      // Code 70 = 1 marks the polyline closed, and the writer repeats the first vertex.
      expect(cut?.pairs.find((p) => p[0] === 70)?.[1]).toBe("1");
      expect(cut?.vertices.at(0)).toEqual(cut?.vertices.at(-1));
      const piece = draft.pieces[i];
      const closed = (pts: readonly (readonly [number, number])[]) => len(pts.map((p): [number, number] => [p[0], p[1]]));
      expect(Math.abs(closed(cut?.vertices ?? []) - len([...piece.cutLine, piece.cutLine[0]]))).toBeLessThan(0.5);
      expect(Math.abs(closed(sew?.vertices ?? []) - len([...piece.sewLine, piece.sewLine[0]]))).toBeLessThan(0.5);
    });
  });

  it("puts the grain line, the notches and the labels on the spec's layers, and no drill holes", () => {
    const layers = new Set(parseDxf(perSize.M).blocks.flatMap((b) => b.entities.map((e) => e.layer)));
    for (const layer of [DXF_LAYERS.cut, DXF_LAYERS.sew, DXF_LAYERS.notch, DXF_LAYERS.grain]) expect(layers).toContain(layer);
    expect(layers).not.toContain(DXF_LAYERS.drill);
  });
});
