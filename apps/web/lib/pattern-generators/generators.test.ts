import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalDisplayList, paramProblems, type GeneratorContext, type PatternGenerator } from "@/lib/artwork-stack/generator";
import type { BoundsMm } from "@/lib/artwork-stack/units";
import type { TileGenerator } from "./common";
import { contextOf, FRONT_BOUNDS } from "./fixtures/contexts";
import { colourAt } from "./fixtures/sample";
import { ALL_GENERATORS, NEW_GENERATORS } from "./registry";
import { SHAPE_BUDGET } from "./shapes";

const hash = (generator: PatternGenerator, patch: Partial<GeneratorContext> = {}): string =>
  createHash("sha256").update(canonicalDisplayList(generator.render(contextOf(patch)))).digest("hex");

/** Generators that draw something from the seed. A gradient is the same every time, so it has none. */
const SEEDED = NEW_GENERATORS.filter((generator) => generator.id !== "gradient");

/** A piece-sized plane, and the same plane in two halves that meet at x = 0. */
const WHOLE: BoundsMm = { minX: -300, minY: 0, maxX: 300, maxY: 800 };
const LEFT: BoundsMm = { ...WHOLE, maxX: 0 };
const RIGHT: BoundsMm = { ...WHOLE, minX: 0 };

const settingsOf = (generator: PatternGenerator, pick: "min" | "max"): Record<string, number | boolean> =>
  Object.fromEntries(generator.params.map((spec) => [spec.id, spec.unit === "yes-no" ? pick === "max" : pick === "min" ? spec.min : spec.max]));

describe("every generator", () => {
  it.each(ALL_GENERATORS.map((generator) => [generator.id, generator] as const))("%s: same seed and settings give the same list on two runs", (_id, generator) => {
    expect(hash(generator)).toBe(hash(generator));
    expect(generator.render(contextOf()).shapes.length).toBeGreaterThan(0);
  });

  it.each(SEEDED.map((generator) => [generator.id, generator] as const))("%s: another seed changes the drawing", (id, generator) => {
    const settings: Record<string, number> = id === "stripe-rhythm" ? { rhythm: 3 } : {};
    expect(hash(generator, { seed: 1, params: settings })).not.toBe(hash(generator, { seed: 2, params: settings }));
  });

  it.each(ALL_GENERATORS.map((generator) => [generator.id, generator] as const))("%s: states a name, a label, settings with words and at most 5 colours", (id, generator) => {
    expect(generator.id).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    expect(generator.label.length).toBeGreaterThan(2);
    expect(generator.maxColours).toBeLessThanOrEqual(5);
    for (const spec of generator.params) {
      expect(spec.min).toBeLessThan(spec.max);
      expect(spec.default ?? spec.min).toBeGreaterThanOrEqual(spec.min);
      expect(spec.default ?? spec.min).toBeLessThanOrEqual(spec.max);
      if (id !== "kit-fade" && NEW_GENERATORS.includes(generator) && spec.unit !== "none" && spec.unit !== "yes-no") expect(spec.words?.up.length).toBeGreaterThan(0);
    }
    expect(paramProblems(generator, settingsOf(generator, "max"))).toEqual([]);
  });

  it.each(NEW_GENERATORS.map((generator) => [generator.id, generator] as const))("%s: stays inside the shape budget with every setting at its minimum and at its maximum", (_id, generator) => {
    for (const pick of ["min", "max"] as const) {
      const list = generator.render(contextOf({ bounds: WHOLE, params: settingsOf(generator, pick) }));
      expect(list.shapes.length).toBeLessThanOrEqual(SHAPE_BUDGET);
      expect(list.shapes.length).toBeGreaterThan(0);
    }
  });

  it.each(NEW_GENERATORS.map((generator) => [generator.id, generator] as const))("%s: clamps a setting out of range instead of failing", (_id, generator) => {
    const wild = Object.fromEntries(generator.params.map((spec) => [spec.id, spec.max * 100]));
    expect(generator.render(contextOf({ params: wild })).shapes.length).toBeGreaterThan(0);
  });

  it.each(NEW_GENERATORS.map((generator) => [generator.id, generator] as const))("%s: works with one colour and with none", (_id, generator) => {
    expect(generator.render(contextOf({ colours: ["#336699"] })).shapes.length).toBeGreaterThan(0);
    expect(generator.render(contextOf({ colours: [] })).shapes.length).toBeGreaterThan(0);
  });
});

describe("field generators are continuous across the line where two bounds meet", () => {
  const fields = NEW_GENERATORS.filter((generator) => generator.repeat.kind === "field");
  const settings: Record<string, Record<string, number>> = { camo: { scaleMm: 40 }, "stripe-rhythm": { rhythm: 3, angleDeg: 30 }, gradient: { mode: 1 } };

  it.each(fields.map((generator) => [generator.id, generator] as const))("%s", (id, generator) => {
    const patch = { params: settings[id] ?? {}, seed: 5 };
    const lists = { whole: generator.render(contextOf({ ...patch, bounds: WHOLE })), left: generator.render(contextOf({ ...patch, bounds: LEFT })), right: generator.render(contextOf({ ...patch, bounds: RIGHT })) };
    let compared = 0;
    for (let y = 5; y < 800; y += 37) {
      for (const x of [-60.3, -20.1, -0.4, 0.4, 20.1, 60.3, -140.7, 140.7]) {
        const part = x < 0 ? lists.left : lists.right;
        expect(colourAt(part, { x, y }, "ground")).toBe(colourAt(lists.whole, { x, y }, "ground"));
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(100);
  });
});

describe("tile generators repeat: opposite edges match", () => {
  const tiles = NEW_GENERATORS.filter((generator): generator is TileGenerator => generator.repeat.kind === "tile");

  it("has at least the checks", () => expect(tiles.map((generator) => generator.id)).toContain("checks"));

  it.each(tiles.map((generator) => [generator.id, generator] as const))("%s", (_id, generator) => {
    for (const kind of [0, 1, 2]) {
      const params = { kind, sizeMm: 16 };
      const { width, height } = generator.tileOf(params);
      const list = generator.render(contextOf({ bounds: { minX: -2 * width, minY: -2 * height, maxX: 3 * width, maxY: 3 * height }, params, datum: { x: 0, y: 0 } }));
      for (let k = 0; k < 120; k += 1) {
        const point = { x: (k * 7.31) % width, y: (k * 3.77) % height };
        const edgeX = k % 2 === 0 ? 0.004 : width - 0.004;
        const left = colourAt(list, { x: edgeX - width * (k % 2 === 0 ? 0 : 1), y: point.y }, "g");
        const right = colourAt(list, { x: edgeX + width * (k % 2 === 0 ? 1 : 0), y: point.y }, "g");
        expect(right).toBe(left);
        expect(colourAt(list, { x: point.x, y: point.y + height }, "g")).toBe(colourAt(list, point, "g"));
        expect(colourAt(list, { x: point.x + width, y: point.y }, "g")).toBe(colourAt(list, point, "g"));
      }
    }
  });
});

describe("what each generator draws", () => {
  it("camo uses as many colours as it is given, up to its setting", () => {
    const fills = (colours: string[], colourCount: number): Set<string> =>
      new Set(NEW_GENERATORS.find((g) => g.id === "camo")?.render(contextOf({ colours, params: { colourCount } })).shapes.map((s) => s.fill));
    expect(fills(["#111111", "#222222", "#333333", "#444444", "#555555"], 3).size).toBe(3);
    expect(fills(["#111111", "#222222"], 5).size).toBe(2);
  });

  it("gradient: the old fade look runs from the first colour to the second", () => {
    const gradient = NEW_GENERATORS.find((g) => g.id === "gradient") as PatternGenerator;
    const list = gradient.render(contextOf({ colours: ["#000000", "#ffffff"], params: { mode: 0, angleDeg: 90, lengthMm: 400 }, datum: { x: 0, y: 350 } }));
    const top = colourAt(list, { x: 0, y: 10 }, "g");
    const bottom = colourAt(list, { x: 0, y: 690 }, "g");
    expect(top < "#202020").toBe(true);
    expect(bottom > "#e0e0e0").toBe(true);
  });

  it("gradient: stepped, radial and angled modes all draw", () => {
    const gradient = NEW_GENERATORS.find((g) => g.id === "gradient") as PatternGenerator;
    const counts = [0, 1, 2, 3].map((mode) => gradient.render(contextOf({ params: { mode, steps: 4, stops: 3, angleDeg: 33 } })).shapes.length);
    expect(counts[2]).toBeLessThan(counts[0] as number);
    expect(counts.every((count) => count > 1)).toBe(true);
  });

  it("halftone dots shrink along the direction and can be reversed", () => {
    const halftone = NEW_GENERATORS.find((g) => g.id === "halftone") as PatternGenerator;
    const radius = (reverse: number, top: boolean): number => {
      const shapes = halftone.render(contextOf({ params: { reverse, angleDeg: 90, lengthMm: 400 }, datum: { x: 0, y: 350 } })).shapes.flatMap((s) => (s.kind === "circle" ? [s] : []));
      const pick = shapes.filter((s) => (top ? s.centre.y < 200 : s.centre.y > 500));
      return Math.max(...pick.map((s) => s.radius));
    };
    expect(radius(0, true)).toBeLessThan(radius(0, false));
    expect(radius(1, true)).toBeGreaterThan(radius(1, false));
  });

  it("geometric draws each motif, with the base underneath", () => {
    const geometric = NEW_GENERATORS.find((g) => g.id === "geometric") as PatternGenerator;
    const hashes = [0, 1, 2, 3].map((motif) => hash(geometric, { params: { motif } }));
    expect(new Set(hashes).size).toBe(4);
    expect(geometric.render(contextOf({ params: { motif: 1 } })).shapes[0]?.fill).toBe("#d4af37");
  });

  it("stripe rhythms: even, graduated, double and irregular differ, and an angle slants the bands", () => {
    const rhythm = NEW_GENERATORS.find((g) => g.id === "stripe-rhythm") as PatternGenerator;
    const hashes = [0, 1, 2, 3].map((value) => hash(rhythm, { params: { rhythm: value } }));
    expect(new Set(hashes).size).toBe(4);
    expect(hash(rhythm, { params: { angleDeg: 45 } })).not.toBe(hash(rhythm));
  });

  it("simplifies, and says so, when a tiny pattern is asked for over a huge area", () => {
    const halftone = NEW_GENERATORS.find((g) => g.id === "halftone") as PatternGenerator;
    const list = halftone.render(contextOf({ bounds: { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }, params: { pitchMm: 4, lengthMm: 1500 } }));
    expect(list.note).toMatch(/20 000/);
    expect(list.shapes.length).toBeLessThanOrEqual(SHAPE_BUDGET);
    expect(generatorNote(FRONT_BOUNDS)).toBeUndefined();
  });
});

function generatorNote(bounds: BoundsMm): string | undefined {
  return (NEW_GENERATORS.find((g) => g.id === "halftone") as PatternGenerator).render(contextOf({ bounds })).note;
}
