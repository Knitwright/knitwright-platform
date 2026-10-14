import { describe, expect, it } from "vitest";
import { paramProblems } from "@/lib/artwork-stack/generator";
import { choicesOf } from "./choices";
import { contextOf } from "./fixtures/contexts";
import { PRESETS, presetsOf } from "./presets";
import { ALL_GENERATORS, findGenerator } from "./registry";

describe("presets", () => {
  it("gives every generator that has settings three named presets", () => {
    for (const generator of ALL_GENERATORS) {
      expect(presetsOf(generator.id), generator.id).toHaveLength(generator.params.length === 0 ? 0 : 3);
    }
  });

  it("keeps the old fade as presets of the gradient", () => {
    expect(findGenerator("kit-fade")?.params).toEqual([]);
    expect(presetsOf("gradient").map((entry) => entry.id)).toContain("gradient/fade-down");
  });

  it("has unique ids, plain labels, and settings that are in range and drawable", () => {
    expect(new Set(PRESETS.map((entry) => entry.id)).size).toBe(PRESETS.length);
    for (const entry of PRESETS) {
      const generator = findGenerator(entry.generatorId);
      expect(generator, entry.id).toBeDefined();
      if (generator === undefined) continue;
      expect(paramProblems(generator, entry.params), entry.id).toEqual([]);
      expect(entry.label).not.toMatch(/production-ready|verified|approved/i);
      expect(generator.render(contextOf({ params: entry.params, seed: entry.seed ?? 0 })).shapes.length, entry.id).toBeGreaterThan(0);
    }
  });

  it("names the choices of the settings that pick from a list", () => {
    expect(choicesOf("geometric", "motif")).toContain("hexagons");
    expect(choicesOf("camo", "scaleMm")).toBeUndefined();
  });
});
