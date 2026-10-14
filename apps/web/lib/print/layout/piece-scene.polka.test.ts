import { describe, expect, it } from "vitest";
import { currentStack } from "@/lib/artwork-stack";
import { BENCHMARK_DOTS, FILE_ID, LOGO_AND_TEXT, MARKS, jersey } from "@/lib/artwork-stack/fixtures/designs";
import { squareLogo } from "../fixtures/assets";
import { makeEnv } from "../fixtures/env";
import { TEST_GRADED_JERSEY } from "../fixtures/graded";
import { shapeBounds } from "../geometry/boolean";
import { boundsOf, boxesOverlap, dot, growBox, sub, unit, type Pt } from "../geometry/vec";
import { buildPieceScene } from "./piece-scene";
import type { PieceScene, VectorLayer } from "./scene";

const stack = currentStack(jersey({ kitPattern: BENCHMARK_DOTS, artwork: LOGO_AND_TEXT, namesAndNumbers: MARKS }));
const patternOf = (scene: PieceScene): VectorLayer => scene.layers.find((l): l is VectorLayer => l.kind === "vector" && l.layerId === "kit-pattern")!;

async function scenes(size: string) {
  const env = await makeEnv(stack, { assets: [await squareLogo(FILE_ID, 600)] });
  const [front, back] = await Promise.all([buildPieceScene(env, { view: "front", size }), buildPieceScene(env, { view: "back", size })]);
  return { env, front: front!, back: back! };
}

/** Dots that are whole: 30 mm across. Their centres are what rows and columns are measured from. */
const wholeDots = (layer: VectorLayer): Pt[] =>
  layer.shapes
    .map((s) => shapeBounds(s.shape))
    .filter((b) => Math.hypot(b.maxX - b.minX, b.maxY - b.minY) > 0 && Math.abs(b.maxX - b.minX) < 30.5 && Math.abs(b.maxY - b.minY) < 30.5 && b.maxX - b.minX > 29.5 && b.maxY - b.minY > 29.5)
    .map((b): Pt => [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2]);

describe("polka-dot jersey (case 1, scene level)", () => {
  for (const size of TEST_GRADED_JERSEY.sizes) {
    it(`size ${size}: rows meet at the chest line across the side seam, and a column sits on the centre front and back`, async () => {
      const { env, front, back } = await scenes(size);
      const height = (scene: PieceScene, centre: Pt): number => {
        const f = env.mapper.frame(scene.view, size)!;
        const up: Pt = unit([-f.down[0], -f.down[1]]);
        return dot(sub(centre, f.origin), up) - dot(sub(f.opened.landmarks.underarm!, f.origin), up);
      };
      const rows = (scene: PieceScene): number[] => [...new Set(wholeDots(patternOf(scene)).map((c) => Math.round(height(scene, c) * 10) / 10))].sort((a, b) => a - b);
      const [rf, rb] = [rows(front), rows(back)];
      expect(rf.length).toBeGreaterThan(5);
      expect(rb.length).toBeGreaterThan(5);
      // Rows are 35 mm apart on one datum, so every row on both pieces sits at the same phase of 35 mm.
      const phase = (h: number): number => ((h % 35) + 35) % 35;
      const apart = (a: number, b: number): number => Math.min(Math.abs(a - b), 35 - Math.abs(a - b));
      for (const h of [...rf, ...rb]) expect(apart(phase(h), phase(rf[0]))).toBeLessThan(0.5);
      for (const scene of [front, back]) {
        const f = env.mapper.frame(scene.view, size)!;
        const centreLine = (c: Pt): number => Math.abs(dot(sub(c, f.origin), f.right));
        expect(Math.min(...wholeDots(patternOf(scene)).map(centreLine))).toBeLessThan(0.5);
      }
    });
  }

  it("keeps every dot out of the 1.0 cm around the number, name and crest", async () => {
    const { front, back } = await scenes("48");
    for (const scene of [front, back]) {
      const marks = scene.layers.filter((l): l is VectorLayer => l.kind === "vector" && /^mark-|crest/.test(l.layerId));
      for (const mark of marks) {
        const ink = boundsOf(mark.shapes.flatMap((s) => s.shape.flat() as Pt[]));
        const keepOut = growBox(ink, 10);
        for (const dotShape of patternOf(scene).shapes) expect(boxesOverlap(shapeBounds(dotShape.shape), keepOut), `${scene.view} ${mark.layerId}`).toBe(false);
      }
    }
  });

  it("is the same every time", async () => {
    const [a, b] = [await scenes("50"), await scenes("50")];
    expect(JSON.stringify(a.back.layers)).toBe(JSON.stringify(b.back.layers));
  });
});
