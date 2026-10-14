import { describe, expect, it } from "vitest";
import { BUILT_IN_GENERATORS, currentStack } from "@/lib/artwork-stack";
import { BENCHMARK_DOTS, jersey } from "@/lib/artwork-stack/fixtures/designs";
import type { PatternLayer } from "@/lib/artwork-stack";
import { TEST_BASE_SIZE, TEST_GRADED_JERSEY } from "../fixtures/graded";
import { shapeBounds, shapeArea } from "../geometry/boolean";
import { boundsOf, offsetPoly } from "./test-helpers";
import { DEFAULT_SETTINGS, type BuildEnv } from "./context";
import { createLayoutMapper } from "./mapper";
import { NO_SCALE, createPrintSpace } from "./print-space";
import { buildPatternShapes } from "./pattern";
import { EMPTY_RULES } from "../rules";
import { ZONE_TEMPLATES } from "../zones";
import { loadBundledFont } from "../text/font";
import { createFakeAssetReader } from "@/lib/artwork-stack";

const stack = currentStack(jersey({ kitPattern: BENCHMARK_DOTS }));
const layer = stack.layers.find((l): l is PatternLayer => l.kind === "pattern")!;
const mapper = createLayoutMapper({ pattern: TEST_GRADED_JERSEY, baseSize: TEST_BASE_SIZE });

async function env(): Promise<BuildEnv> {
  return {
    stack,
    colourwayId: stack.colourways[0].id,
    mapper,
    zoneTemplates: ZONE_TEMPLATES,
    generators: BUILT_IN_GENERATORS,
    assets: createFakeAssetReader([]),
    settings: DEFAULT_SETTINGS,
    rules: EMPTY_RULES,
    scale: { ...NO_SCALE, note: null },
    font: await loadBundledFont(),
    patternReviewed: false,
    scaleSource: null,
  };
}

const build = async (view: "front" | "back", size: string) => {
  const e = await env();
  const space = createPrintSpace(mapper, view, size, NO_SCALE)!;
  const bleed = offsetPoly(space.outline, 15);
  return { space, bleed, result: buildPatternShapes({ env: e, layer, space, view, size, bleedOutline: bleed, ground: "#ffffff" }) };
};

describe("pattern layer", () => {
  it("draws the benchmark dots on a piece, cut to the bleed outline", async () => {
    const { result, bleed } = await build("front", "48");
    expect(result.shapes.length).toBeGreaterThan(50);
    const b = boundsOf(bleed);
    for (const s of result.shapes) {
      const sb = shapeBounds(s.shape);
      expect(sb.minX).toBeGreaterThanOrEqual(b.minX - 0.01);
      expect(sb.maxX).toBeLessThanOrEqual(b.maxX + 0.01);
    }
    expect(new Set(result.shapes.map((s) => s.fill)).size).toBeGreaterThanOrEqual(2);
  });
  it("makes whole dots of the stated width wherever they are not cut", async () => {
    const { result } = await build("front", "48");
    const whole = result.shapes.filter((s) => {
      const b = shapeBounds(s.shape);
      return Math.abs(b.maxX - b.minX - 30) < 0.1 && Math.abs(b.maxY - b.minY - 30) < 0.1;
    });
    expect(whole.length).toBeGreaterThan(20);
    for (const s of whole) expect(shapeArea(s.shape)).toBeGreaterThan(Math.PI * 15 * 15 * 0.95);
  });
  it("is the same every time", async () => {
    const a = JSON.stringify((await build("back", "50")).result.shapes);
    const b = JSON.stringify((await build("back", "50")).result.shapes);
    expect(a).toBe(b);
  });
  it("says so when the pattern's generator is not known", async () => {
    const e = await env();
    const space = createPrintSpace(mapper, "front", "48", NO_SCALE)!;
    const r = buildPatternShapes({ env: { ...e, generators: [] }, layer, space, view: "front", size: "48", bleedOutline: space.outline, ground: "#ffffff" });
    expect(r.shapes).toEqual([]);
    expect(r.issues[0].text).toMatch(/not available/);
  });
});
