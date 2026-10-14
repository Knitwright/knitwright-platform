import { describe, expect, it } from "vitest";
import { applySteps, assistantSchema, choiceLabel, choicesFromWords, generatorFromWords, schemaOf, stepsAsked, wordsToSteps } from "./assistant";
import { camo } from "./generators/camo";
import { geometric } from "./generators/geometric";
import { getGenerator } from "./registry";

describe("the assistant's schema", () => {
  it("lists every style with units, ranges, steps and plain words", () => {
    const all = assistantSchema();
    expect(all).toHaveLength(17);
    const entry = schemaOf(camo);
    expect(entry).toMatchObject({ id: "camo", repeat: "field", maxColours: 5 });
    expect(entry.params[0]).toMatchObject({ id: "scale", unit: "mm", min: 30, max: 120, step: 10, default: 60 });
    expect(entry.params[0].up).toContain("bigger");
    expect(entry.presets).toHaveLength(3);
    expect(schemaOf(geometric).params[0].choices).toEqual(["chevron", "diamonds", "triangles", "hexagons"]);
    expect(schemaOf(geometric).repeat).toBe("tile");
    expect(schemaOf(getGenerator("kit-hoops")!).params[0].default).toBeNull();
  });
});

describe("words to steps", () => {
  it("maps plain words to a step up or down, never to a number", () => {
    expect(wordsToSteps(camo, "bigger")).toEqual([{ paramId: "scale", direction: "up", steps: 1 }]);
    expect(wordsToSteps(camo, "make it smaller and calmer")).toEqual([
      { paramId: "scale", direction: "down", steps: 1 },
      { paramId: "spread", direction: "down", steps: 1 },
    ]);
    expect(wordsToSteps(camo, "a lot bigger")).toEqual([{ paramId: "scale", direction: "up", steps: 3 }]);
    expect(wordsToSteps(camo, "a bit bigger")).toEqual([{ paramId: "scale", direction: "up", steps: 1 }]);
    expect(wordsToSteps(camo, "bigger, then much smaller")).toEqual([{ paramId: "scale", direction: "up", steps: 1 }]);
    expect(wordsToSteps(camo, "make it purple")).toEqual([]);
    expect(stepsAsked("far bigger")).toBe(3);
    expect(stepsAsked("a lot a bit bigger")).toBe(1);
  });

  it("reads pick-one settings and style names", () => {
    expect(choicesFromWords(geometric, "make it diamonds")).toEqual({ motif: 1 });
    expect(choicesFromWords(geometric, "hexagons please")).toEqual({ motif: 3 });
    expect(choicesFromWords(camo, "diamonds")).toEqual({});
    expect(generatorFromWords("make the camouflage bigger")?.id).toBe("camo");
    expect(generatorFromWords("fade it")?.id).toBe("gradient");
    expect(generatorFromWords("hoops")?.id).toBe("kit-hoops");
    expect(generatorFromWords("something else")).toBeUndefined();
    expect(choiceLabel(geometric.params[0], 2)).toBe("triangles");
    expect(choiceLabel(camo.params[0], 2)).toBe("2");
  });
});

describe("applying steps", () => {
  it("moves a setting by its own step and reports before and after", () => {
    const out = applySteps(camo, { scale: 60 }, [{ paramId: "scale", direction: "up", steps: 1 }]);
    expect(out.params).toEqual({ scale: 70 });
    expect(out.changes).toEqual([{ paramId: "scale", label: "Camo blob size", before: "6 cm", after: "7 cm", beforeValue: 60, afterValue: 70, clamped: false }]);
    expect(out.sentences).toEqual([]);
  });

  it("starts from the default when the setting was not set", () => {
    expect(applySteps(camo, {}, [{ paramId: "spread", direction: "up", steps: 1 }]).params).toEqual({ spread: 0.7 });
  });

  it("stops at the end of the range and says so", () => {
    const top = applySteps(camo, { scale: 110 }, [{ paramId: "scale", direction: "up", steps: 3 }]);
    expect(top.params).toEqual({ scale: 120 });
    expect(top.changes[0].clamped).toBe(true);
    expect(top.sentences).toEqual(["Largest camo blob is 12 cm."]);
    const bottom = applySteps(camo, { scale: 30 }, [{ paramId: "scale", direction: "down", steps: 1 }]);
    expect(bottom.changes).toEqual([]);
    expect(bottom.sentences).toEqual(["Smallest camo blob is 3 cm."]);
  });

  it("says when a setting has no value to move from", () => {
    const hoops = getGenerator("kit-hoops")!;
    expect(applySteps(hoops, {}, [{ paramId: "bandWidthMm", direction: "up", steps: 1 }]).sentences).toEqual(["Band width has no set value yet, so say how much, in centimetres."]);
    expect(applySteps(hoops, { bandWidthMm: 90 }, [{ paramId: "bandWidthMm", direction: "up", steps: 1 }]).params).toEqual({ bandWidthMm: 90.5 });
    expect(applySteps(hoops, {}, [{ paramId: "nothing", direction: "up", steps: 1 }]).sentences).toEqual(["nothing has no set value yet, so say how much, in centimetres."]);
  });
});
