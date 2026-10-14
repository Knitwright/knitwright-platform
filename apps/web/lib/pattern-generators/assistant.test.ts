import { describe, expect, it } from "vitest";
import { assistantSchema, assistantSchemas, chooseOption, currentValue, lengthText, paramForWord, stepParam } from "./assistant";
import { findGenerator } from "./registry";

const camo = findGenerator("camo");
const geometric = findGenerator("geometric");
if (camo === undefined || geometric === undefined) throw new Error("missing generator");

describe("assistant schema", () => {
  it("lists every generator with units, ranges, defaults and words", () => {
    const all = assistantSchemas();
    expect(all.map((entry) => entry.id)).toContain("camo");
    const schema = assistantSchema(camo);
    expect(schema).toMatchObject({ id: "camo", repeat: "field", maxColours: 5 });
    expect(schema.params.find((entry) => entry.id === "scaleMm")).toMatchObject({ unit: "mm", min: 20, max: 120, default: 60, up: expect.arrayContaining(["bigger"]) });
    expect(assistantSchema(geometric).params.find((entry) => entry.id === "motif")?.choices).toContain("diamonds");
    expect(assistantSchema(findGenerator("kit-hoops") ?? camo).params[0]?.default).toBeNull();
  });
});

describe("words to steps", () => {
  it("maps a plain word to a setting and a direction", () => {
    expect(paramForWord(camo, "Bigger")).toEqual({ paramId: "scaleMm", direction: "up" });
    expect(paramForWord(camo, " finer ")).toEqual({ paramId: "scaleMm", direction: "down" });
    expect(paramForWord(camo, "sparser")).toEqual({ paramId: "spread", direction: "down" });
    expect(paramForWord(camo, "spicy")).toBeNull();
  });

  it("moves a setting by whole steps and says before and after", () => {
    const step = stepParam(camo, { scaleMm: 60 }, "scaleMm", "up");
    expect(step).toMatchObject({ before: 60, after: 70, clamped: false });
    expect(step?.sentence).toBe("Blob size: 60 mm to 70 mm.");
    expect(stepParam(camo, {}, "scaleMm", "down", 2)?.after).toBe(40);
  });

  it("clamps at the end of the range and says so", () => {
    const stopped = stepParam(camo, { scaleMm: 120 }, "scaleMm", "up");
    expect(stopped).toMatchObject({ after: 120, clamped: true, sentence: "Largest camo blob size is 12 cm." });
    const short = stepParam(camo, { scaleMm: 25 }, "scaleMm", "down");
    expect(short?.sentence).toBe("Blob size: 25 mm to 20 mm. Smallest camo blob size is 20 mm.");
    expect(stepParam(camo, { scaleMm: 20 }, "scaleMm", "down")?.sentence).toBe("Smallest camo blob size is 20 mm.");
    expect(stepParam(camo, {}, "nothing", "up")).toBeNull();
  });

  it("states unitless and angle settings plainly", () => {
    expect(stepParam(camo, { spread: 1.5 }, "spread", "up")?.sentence).toBe("Largest camo how crowded is 1.5.");
    const stripes = findGenerator("stripe-rhythm");
    expect(stripes && stepParam(stripes, { angleDeg: 175 }, "angleDeg", "up")?.sentence).toBe("Largest stripe rhythms angle is 175 degrees.");
    expect(lengthText(45)).toBe("45 mm");
    expect(lengthText(150)).toBe("15 cm");
  });

  it("picks a choice by name", () => {
    expect(chooseOption(geometric, {}, "motif", "Hexagons")).toMatchObject({ before: 0, after: 3, sentence: "Shape: chevron to hexagons." });
    expect(chooseOption(geometric, {}, "motif", "stars")).toBeNull();
    expect(chooseOption(geometric, {}, "missing", "hexagons")).toBeNull();
    expect(currentValue(geometric.params[0] ?? ({} as never), { motif: 2 })).toBe(2);
  });
});
