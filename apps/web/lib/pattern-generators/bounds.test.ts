import { describe, expect, it } from "vitest";
import type { BoundsMm } from "@/lib/artwork-stack/units";
import { boundsProblem } from "./bounds";
import { SHAPE_BUDGET } from "./define";
import { GENERATORS, getGenerator } from "./registry";
import { contextFor } from "./test-support";

const BAD: readonly (readonly [string, BoundsMm])[] = [
  ["NaN", { minX: Number.NaN, minY: 0, maxX: 600, maxY: 800 }],
  ["infinite", { minX: 0, minY: 0, maxX: Number.POSITIVE_INFINITY, maxY: 800 }],
  ["zero width", { minX: 10, minY: 0, maxX: 10, maxY: 800 }],
  ["zero height", { minX: 0, minY: 5, maxX: 600, maxY: 5 }],
  ["upside down", { minX: 0, minY: 0, maxX: -600, maxY: 800 }],
];

describe("boundsProblem", () => {
  it("accepts a normal area", () => expect(boundsProblem({ minX: 0, minY: 0, maxX: 600, maxY: 800 })).toBeNull());
  it.each(BAD)("refuses %s in plain words", (_name, bounds) => expect(boundsProblem(bounds)).toMatch(/pattern area/i));
});

describe.each(GENERATORS.map((generator) => [generator.id, generator] as const))("%s with a broken area", (_id, generator) => {
  it.each(BAD)("refuses %s instead of looping or drawing", (_name, bounds) => {
    expect(() => generator.render(contextFor(generator, { bounds }))).toThrow(/pattern area/i);
  });
});

describe("shape budgets", () => {
  const huge: BoundsMm = { minX: -50_000, minY: -50_000, maxX: 50_000, maxY: 50_000 };
  it.each([0, 1, 2, 3])("stripe-variations rhythm %i stays inside the budget on a huge area and says so", (rhythm) => {
    const generator = getGenerator("stripe-variations")!;
    const list = generator.render(contextFor(generator, { bounds: huge, params: { rhythm, width: 5, grow: 1 } }));
    expect(list.shapes.length).toBeLessThanOrEqual(SHAPE_BUDGET);
    expect(list.note).toBeDefined();
  });
  it("graduated and irregular rhythms take linear time", () => {
    const generator = getGenerator("stripe-variations")!;
    const started = performance.now();
    for (const rhythm of [1, 3]) generator.render(contextFor(generator, { bounds: { minX: 0, minY: 0, maxX: 20_000, maxY: 20_000 }, params: { rhythm, width: 5 } }));
    expect(performance.now() - started).toBeLessThan(1500);
  });
  it("gradient says so when it has to cut steps down", () => {
    const generator = getGenerator("gradient")!;
    const list = generator.render(contextFor(generator, { params: { steps: 48 } }));
    expect(list.shapes.length).toBeLessThanOrEqual(SHAPE_BUDGET);
  });
});
