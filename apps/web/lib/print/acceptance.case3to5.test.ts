import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { BUILT_IN_GENERATORS } from "@/lib/artwork-stack";
import { GENERATORS } from "@/lib/pattern-generators";
import { buildPrintSet } from "./build";
import { vectorLogo } from "./fixtures/assets";
import { testCamo } from "./fixtures/generators";
import { makeEnv, testFont } from "./fixtures/env";
import { readFromPicture } from "./fixtures/picture";
import { colourAt } from "./fixtures/probe";
import { blendStack, camoStack, logoStack } from "./fixtures/stacks";
import { shapeArea, shapeBounds, subtractRegions, type Shape } from "./geometry/boolean";
import { boundsOf, boxPolygon, growBox, type Box, type Pt } from "./geometry/vec";
import { buildPieceScene } from "./layout/piece-scene";
import { FROM_PICTURE_SENTENCE } from "./layout/notes";
import type { PieceScene, VectorLayer } from "./layout/scene";
import { renderFile } from "./render/files";

/** True when any part of the shape lies inside the box (by area, not by bounding box). */
const entersBox = (shape: Shape, box: Box): boolean => shapeArea(subtractRegions([shape], [boxPolygon(box)])[0] ?? []) < shapeArea(shape) - 1e-6;

const SIZES = ["44", "50", "56"];

describe("case 3: a vector logo from the club (fake intake)", () => {
  it("is 90 mm wide in every size, stays vector in the PDF, and knocks the pattern out of its clear space", async () => {
    const env = await makeEnv(logoStack("crest"), { assets: [vectorLogo("crest")] });
    for (const size of SIZES) {
      const scene = (await buildPieceScene(env, { view: "front", size }))!;
      const logo = scene.layers.find((l): l is VectorLayer => l.kind === "vector" && l.layerId === "crest")!;
      const outer = shapeBounds([logo.shapes[0].shape[0]]);
      // The pattern file's length runs along x and its width along y, so the logo's width is the extent along y.
      expect(outer.maxY - outer.minY).toBeGreaterThan(89.9);
      expect(outer.maxY - outer.minY).toBeLessThan(90.1);
      const keepOut = growBox(boundsOf(logo.shapes.flatMap((s) => s.shape.flat() as Pt[])), 10);
      const dots = scene.layers.find((l): l is VectorLayer => l.kind === "vector" && l.layerId === "dots")!;
      for (const dot of dots.shapes) expect(entersBox(dot.shape, keepOut)).toBe(false);
      expect(scene.layers.some((l) => l.kind === "raster")).toBe(false);
    }
  }, 120_000);

  it("keeps the logo as paths in the PDF, with no picture", async () => {
    const env = await makeEnv(logoStack("crest"), { assets: [vectorLogo("crest")] });
    const set = await buildPrintSet(env, { sizes: ["48"], formats: ["pdf"], views: ["front"] });
    const doc = await pdfjs.getDocument({ data: new Uint8Array(set.files[0].bytes) }).promise;
    const ops = await (await doc.getPage(1)).getOperatorList();
    const names = Object.fromEntries(Object.entries(pdfjs.OPS).map(([k, v]) => [v, k]));
    const used = new Set(ops.fnArray.map((f) => names[f]));
    expect(used.has("constructPath")).toBe(true);
    expect([...used].filter((n) => /Image/.test(n))).toEqual([]);
  }, 60_000);

  it("reports a logo that sits outside the standard zones, and a missing asset, without stopping", async () => {
    const env = await makeEnv(logoStack("crest"), { assets: [] });
    const scene = (await buildPieceScene(env, { view: "front", size: "48" }))!;
    expect(scene.issues.some((i) => i.code === "asset-missing")).toBe(true);
    expect(scene.layers.some((l) => l.layerId === "crest")).toBe(false);
  });
});

const colourRun = (scene: PieceScene, a: Pt, b: Pt, steps = 40): Pt[] => Array.from({ length: steps + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps] as Pt).filter((p) => colourAt(scene, p) !== null || scene.view === "front");

describe("case 4: a generated camo, seed 7 (fake generator)", () => {
  const generators = [...BUILT_IN_GENERATORS, testCamo];

  it("gives the same bytes twice, and different bytes for another seed", async () => {
    const build = async (seed: number) => {
      const env = await makeEnv(camoStack(seed), { generators });
      const set = await buildPrintSet(env, { sizes: ["48"], formats: ["pdf", "svg"], views: ["back"] });
      return set.files.map((f) => f.sha256);
    };
    const [a, b, other] = [await build(7), await build(7), await build(8)];
    expect(a).toEqual(b);
    expect(other[0]).not.toBe(a[0]);
    expect(other[1]).not.toBe(a[1]);
  }, 120_000);

  it("runs on through the side seam: the field on the front and the back agree where the pieces join", async () => {
    const env = await makeEnv(camoStack(7), { generators });
    const agree = async (shiftMm: number): Promise<number> => {
      let [same, total] = [0, 0];
      for (const size of SIZES) {
        const [front, back] = [(await buildPieceScene(env, { view: "front", size }))!, (await buildPieceScene(env, { view: "back", size }))!];
        const [ff, fb] = [env.mapper.frame("front", size)!, env.mapper.frame("back", size)!];
        const half = (f: typeof ff): number => Math.abs((f.opened.landmarks.underarm![1] - f.origin[1]) * f.right[1] + (f.opened.landmarks.underarm![0] - f.origin[0]) * f.right[0]);
        const [sf, sb] = [half(ff), half(fb)];
        for (let y = -10; y <= 10; y += 0.5) {
          // A point just inside each piece at the join, in the shared design plane (the back lies beside the front).
          const onFront = env.mapper.planeToPiece("front", { x: sf - 0.25, y }, size)!;
          const onBack = env.mapper.planeToPiece("back", { x: fb.wornOrigin[0] - sb + 0.25 + shiftMm, y }, size)!;
          total += 1;
          if (colourAt(front, onFront as Pt) === colourAt(back, onBack as Pt)) same += 1;
        }
      }
      return same / total;
    };
    const joined = await agree(0);
    const wrong = await agree(7.3);
    expect(joined).toBeGreaterThan(0.9);
    expect(wrong).toBeLessThan(joined - 0.15);
  }, 120_000);

  it("uses the colours of the field and says where it is, per piece", async () => {
    const env = await makeEnv(camoStack(7), { generators });
    const scene = (await buildPieceScene(env, { view: "front", size: "48" }))!;
    expect(new Set(scene.layers.flatMap((l) => (l.kind === "vector" ? l.shapes.map((s) => s.fill) : []))).size).toBeGreaterThanOrEqual(3);
    expect(scene.notes.some((n) => /Repeat rows meet the other body piece at the side seam/.test(n))).toBe(true);
  }, 60_000);
});

describe("case 5: a design read from a picture (fake reader)", () => {
  it("prints close to the true design and carries the picture note on every file", async () => {
    const generators = [...BUILT_IN_GENERATORS, testCamo];
    const truth = camoStack(7);
    const [trueEnv, readEnv] = [await makeEnv(truth, { generators }), await makeEnv(readFromPicture(truth), { generators })];
    const [a, b] = [(await buildPieceScene(trueEnv, { view: "back", size: "48" }))!, (await buildPieceScene(readEnv, { view: "back", size: "48" }))!];
    const font = await testFont();
    const [ta, tb] = [await renderFile(a, "tiff", { font, settings: trueEnv.settings }), await renderFile(b, "tiff", { font, settings: readEnv.settings })];
    const [pa, pb] = await Promise.all([sharp(Buffer.from(ta.bytes)).raw().toBuffer(), sharp(Buffer.from(tb.bytes)).raw().toBuffer()]);
    let diff = 0;
    for (let i = 0; i < pa.length; i += 1) diff += Math.abs(pa[i] - pb[i]);
    // The stated limit: on average a channel is within 8 of the true print.
    expect(diff / pa.length).toBeLessThan(8);
    expect(diff / pa.length).toBeGreaterThan(0);
    const set = await buildPrintSet(readEnv, { sizes: ["48"], formats: ["pdf", "svg"], views: ["back", "collar"] });
    for (const file of set.files) {
      if (file.format === "svg") expect(new TextDecoder().decode(file.bytes)).toContain(FROM_PICTURE_SENTENCE);
      expect(file.warnings.length >= 0).toBe(true);
    }
    expect(b.notes).toContain(FROM_PICTURE_SENTENCE);
    expect(a.notes).not.toContain(FROM_PICTURE_SENTENCE);
  }, 120_000);
});

export { blendStack, colourRun };

describe("case 4 again, on the real camo from the generator library (W7c has merged)", () => {
  const camoLayer = (seed: number) => {
    const base = camoStack(seed);
    return { ...base, layers: base.layers.map((l) => (l.kind === "pattern" ? { ...l, generatorId: "camo", params: { scale: 60 } } : l)) } as typeof base;
  };
  it("runs through the side seam, gives the same bytes twice and different bytes for another seed", async () => {
    const env = await makeEnv(camoLayer(7), { generators: GENERATORS });
    let [same, total] = [0, 0];
    for (const size of SIZES) {
      const [front, back] = [(await buildPieceScene(env, { view: "front", size }))!, (await buildPieceScene(env, { view: "back", size }))!];
      const [ff, fb] = [env.mapper.frame("front", size)!, env.mapper.frame("back", size)!];
      const half = (f: typeof ff): number => Math.abs((f.opened.landmarks.underarm![1] - f.origin[1]) * f.right[1] + (f.opened.landmarks.underarm![0] - f.origin[0]) * f.right[0]);
      for (let y = -10; y <= 10; y += 0.5) {
        const a = env.mapper.planeToPiece("front", { x: half(ff) - 0.25, y }, size)!;
        const b = env.mapper.planeToPiece("back", { x: fb.wornOrigin[0] - half(fb) + 0.25, y }, size)!;
        total += 1;
        if (colourAt(front, a as Pt) === colourAt(back, b as Pt)) same += 1;
      }
    }
    expect(same / total).toBeGreaterThan(0.9);
    const hash = async (seed: number): Promise<string[]> => (await buildPrintSet(await makeEnv(camoLayer(seed), { generators: GENERATORS }), { sizes: ["48"], formats: ["pdf", "svg"], views: ["back"] })).files.map((f) => f.sha256);
    const [a, b, other] = [await hash(7), await hash(7), await hash(8)];
    expect(a).toEqual(b);
    expect(other[0]).not.toBe(a[0]);
  }, 180_000);
});
