import { describe, expect, it } from "vitest";
import { paramProblems, type PatternGenerator } from "@/lib/artwork-stack/generator";
import type { BoundsMm, PointMm } from "@/lib/artwork-stack/units";
import { SHAPE_BUDGET } from "./define";
import { NEW_GENERATORS, getGenerator, getLibraryGenerator, tileSizeFor } from "./registry";
import { colourAt, displayListHash } from "./sample";
import { contextFor, GROUND, PIECE } from "./test-support";

const render = (generator: PatternGenerator, over: Parameters<typeof contextFor>[1] = {}) => generator.render(contextFor(generator, over));

/** Points that sit off any edge a pattern is likely to have. */
const samples = (bounds: BoundsMm, across = 24, down = 30): PointMm[] =>
  Array.from({ length: down }, (_, j) =>
    Array.from({ length: across }, (_, i) => ({
      x: bounds.minX + ((i + 0.37) / across) * (bounds.maxX - bounds.minX) + 0.0013 * j,
      y: bounds.minY + ((j + 0.41) / down) * (bounds.maxY - bounds.minY) + 0.0017 * i,
    })),
  ).flat();

describe.each(NEW_GENERATORS.map((generator) => [generator.id, generator] as const))("%s", (_id, generator) => {
  it("gives the same display list on two runs, and different seeds give different ones", () => {
    const [a, b] = [displayListHash(render(generator)), displayListHash(render(generator))];
    expect(a).toBe(b);
    expect(displayListHash(render(generator, { seed: 8 }))).not.toBe(a);
    expect(displayListHash(render(generator, { seed: 9 }))).not.toBe(displayListHash(render(generator, { seed: 8 })));
  });

  it("is rounded to 0.01 mm and uses only the colours it is given", () => {
    const list = render(generator);
    const allowed = new Set([...contextFor(generator).colours, "#000000"]);
    const coordinates = list.shapes.flatMap((shape) => (shape.kind === "circle" ? [shape.centre.x, shape.centre.y, shape.radius] : shape.points.flatMap((point) => [point.x, point.y])));
    expect(coordinates.every((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6)).toBe(true);
    expect(list.shapes.length).toBeGreaterThan(0);
    expect(list.shapes.every((shape) => /^#[0-9a-f]{6}$/.test(shape.fill) && (allowed.has(shape.fill) || generator.id === "gradient" || generator.id === "gingham" || generator.id === "camo"))).toBe(true);
  });

  it("stays within the shape budget at the smallest and the largest of every setting", () => {
    const bigPiece: BoundsMm = { minX: 0, minY: 0, maxX: 900, maxY: 1200 };
    for (const spec of generator.params) {
      for (const value of [spec.min, spec.max]) {
        const list = render(generator, { bounds: bigPiece, params: { [spec.id]: value } });
        expect(list.shapes.length, `${spec.id}=${value}`).toBeLessThanOrEqual(SHAPE_BUDGET);
      }
    }
  });

  it("stays within the budget, and says it simplified, on a very large area", () => {
    const huge: BoundsMm = { minX: -4000, minY: -4000, maxX: 4000, maxY: 4000 };
    const smallest = Object.fromEntries(generator.params.map((spec) => [spec.id, spec.min]));
    const list = render(generator, { bounds: huge, params: smallest });
    expect(list.shapes.length).toBeLessThanOrEqual(SHAPE_BUDGET);
  });

  it("clamps settings out of range instead of failing", () => {
    const wild = Object.fromEntries(generator.params.map((spec) => [spec.id, spec.max * 10 + 5]));
    const clamped = Object.fromEntries(generator.params.map((spec) => [spec.id, spec.max]));
    expect(displayListHash(render(generator, { params: wild }))).toBe(displayListHash(render(generator, { params: clamped })));
  });

  it("has settings with a unit, range, default, label and a valid default", () => {
    expect(generator.params.length).toBeGreaterThan(0);
    for (const spec of generator.params) {
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.min).toBeLessThan(spec.max);
      expect(spec.default).toBeGreaterThanOrEqual(spec.min);
      expect(spec.default).toBeLessThanOrEqual(spec.max);
    }
    const defaults = Object.fromEntries(generator.params.map((spec) => [spec.id, spec.default]));
    expect(paramProblems(generator, defaults)).toEqual([]);
    expect(paramProblems(generator, { [generator.params[0].id]: 1e9 })).toHaveLength(1);
  });

  it("gives every word to one setting only", () => {
    const words = generator.params.flatMap((spec) => [...(spec.words?.up ?? []), ...(spec.words?.down ?? [])]);
    expect(new Set(words).size).toBe(words.length);
  });

  it("is the same over a piece as over its two halves (continuous across the seam)", () => {
    const [left, right]: BoundsMm[] = [
      { minX: 0, minY: 0, maxX: 300, maxY: 800 },
      { minX: 300, minY: 0, maxX: 600, maxY: 800 },
    ];
    const whole = render(generator, { bounds: PIECE });
    for (const half of [left, right]) {
      const part = render(generator, { bounds: half });
      const wrong = samples(half).filter((point) => colourAt(part, GROUND, point) !== colourAt(whole, GROUND, point));
      expect(wrong).toEqual([]);
    }
    const [l, r] = [render(generator, { bounds: left }), render(generator, { bounds: right })];
    for (let at = 0; at < 80; at += 1) {
      const y = 7.003 + at * 9.71;
      expect(colourAt(l, GROUND, { x: 299.99, y })).toBe(colourAt(whole, GROUND, { x: 299.99, y }));
      expect(colourAt(r, GROUND, { x: 300.01, y })).toBe(colourAt(whole, GROUND, { x: 300.01, y }));
    }
  });
});

describe("repeat", () => {
  it("declares tile or field, and tile generators declare a tile size", () => {
    for (const generator of NEW_GENERATORS) {
      if (generator.repeat.kind === "tile") {
        expect(generator.repeat.tileMm.width).toBeGreaterThan(0);
        expect(generator.tileFor).toBeDefined();
      } else {
        expect(generator.tileFor).toBeUndefined();
      }
    }
    expect(NEW_GENERATORS.filter((entry) => entry.repeat.kind === "tile").map((entry) => entry.id)).toEqual(["geometric", "checks", "gingham", "houndstooth"]);
  });

  it.each(NEW_GENERATORS.filter((entry) => entry.repeat.kind === "tile").map((entry) => [entry.id, entry] as const))("%s: opposite tile edges match", (_id, generator) => {
    for (const motif of generator.id === "geometric" ? [0, 1, 2, 3] : [0]) {
      const params: Record<string, number> = generator.id === "geometric" ? { motif } : {};
      const tile = tileSizeFor(generator.id, params);
      expect(tile).not.toBeNull();
      const { width, height } = tile!;
      const list = render(generator, { params, bounds: { minX: -2 * width, minY: -2 * height + 200, maxX: 4 * width, maxY: 4 * height + 200 } });
      const inside = samples({ minX: 0, minY: 200, maxX: width, maxY: 200 + height }, 14, 14);
      for (const point of inside) {
        const here = colourAt(list, GROUND, point);
        expect(colourAt(list, GROUND, { x: point.x + width, y: point.y }), `${generator.id} across ${motif}`).toBe(here);
        expect(colourAt(list, GROUND, { x: point.x, y: point.y + height }), `${generator.id} down ${motif}`).toBe(here);
      }
      // The left edge and the right edge of the tile read the same.
      for (let at = 0; at < 20; at += 1) {
        const y = 200 + 0.0371 + (at + 0.5) * (height / 20);
        expect(colourAt(list, GROUND, { x: 0.005, y })).toBe(colourAt(list, GROUND, { x: width + 0.005, y }));
      }
    }
  });
});

describe("registry", () => {
  it("lists nine new generators and finds each by id", () => {
    expect(NEW_GENERATORS).toHaveLength(9);
    expect(new Set(NEW_GENERATORS.map((entry) => entry.id)).size).toBe(9);
    for (const generator of NEW_GENERATORS) {
      expect(getGenerator(generator.id)).toBe(generator);
      expect(getLibraryGenerator(generator.id)).toBe(generator);
    }
    expect(getGenerator("nothing")).toBeUndefined();
  });

  it("gives a tile size at the settings, and none for a field", () => {
    expect(tileSizeFor("checks", { size: 20 })).toEqual({ width: 40, height: 40 });
    expect(tileSizeFor("checks", { size: 20, ratio: 2 })).toEqual({ width: 40, height: 80 });
    expect(tileSizeFor("camo")).toBeNull();
    expect(tileSizeFor("kit-hoops")).toBeNull();
    expect(tileSizeFor("nothing")).toBeNull();
  });
});

/**
 * Fingerprints of each style at the defaults, seed 7, over a 600 x 800 mm piece. They hold the output still across
 * commits and machines (CI compares them on its own Node version): a change to a style changes its line on purpose.
 */
const GOLDEN: Record<string, string> = {
  camo: "0700b3c8ea29f0ce",
  geometric: "708d7594069a89e2",
  gradient: "b5aabcd121df69f0",
  halftone: "102102672624e7bb",
  checks: "f7dd0709158f2186",
  gingham: "b87bdb8b5d33f1c4",
  houndstooth: "70cf9123c2dbf1b1",
  brush: "f9b00db0cb9619b7",
  "stripe-variations": "9c252fd6f8ebe3f9",
};

describe("golden fingerprints", () => {
  it.each(Object.entries(GOLDEN))("%s", (id, hash) => {
    expect(displayListHash(render(getLibraryGenerator(id)!))).toBe(hash);
  });
});
