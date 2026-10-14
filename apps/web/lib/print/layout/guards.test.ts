import { describe, expect, it } from "vitest";
import type { PatternGenerator } from "@/lib/artwork-stack";
import { fieldBoundsFor } from "./field";
import { rig } from "../fixtures/setup";
import { polkaStack } from "../fixtures/stacks";
import type { Box } from "../scene";

const r = rig();

/** A generator that records every box it is asked to draw over. */
const spy = (seen: Box[]): PatternGenerator => ({
  id: "kit-dots",
  label: "Spy dots",
  params: [],
  repeat: { kind: "field" },
  render: (context) => {
    seen.push(context.bounds as Box);
    return { shapes: [] };
  },
});

describe("bounds that reach a generator", () => {
  it.each([
    ["not a number", { minX: Number.NaN, minY: 0, maxX: 100, maxY: 100 }],
    ["infinite", { minX: 0, minY: 0, maxX: Number.POSITIVE_INFINITY, maxY: 100 }],
    ["zero wide", { minX: 5, minY: 0, maxX: 5, maxY: 100 }],
    ["upside down", { minX: 0, minY: 100, maxX: 100, maxY: 0 }],
  ])("are refused when %s, and the pattern is left off with a sentence", async (_name, field) => {
    const seen: Box[] = [];
    const { scene } = await r.scene(polkaStack(), "48", "front", { field, generators: [spy(seen)] });
    expect(seen).toEqual([]);
    expect(scene.issues.some((i) => i.severity === "stop" && /could not be worked out/.test(i.text))).toBe(true);
  });

  it("are passed on when they are sound", async () => {
    const seen: Box[] = [];
    await r.scene(polkaStack(), "48", "front", { generators: [spy(seen)] });
    expect(seen).toHaveLength(1);
    expect(Object.values(seen[0]!).every(Number.isFinite)).toBe(true);
  });

  it("a field is never worked out from nothing", () => {
    const box = fieldBoundsFor([], 0);
    expect(box.maxX - box.minX).toBeGreaterThan(0);
    expect(box.maxY - box.minY).toBeGreaterThan(0);
    expect(Object.values(fieldBoundsFor([], Number.NaN)).every(Number.isFinite)).toBe(true);
  });
});
