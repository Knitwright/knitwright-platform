import { describe, expect, it } from "vitest";
import {
  garmentTypeSchema,
  optionSchema,
  panelSchema,
  pointOfMeasureSchema,
  ruleSchema,
} from "./definitions";

const option = {
  id: "collar",
  label: "Collar",
  choices: [
    { id: "none", label: "No collar" },
    { id: "polo-collar", label: "Polo collar" },
  ],
  defaultChoice: "none",
};

describe("option definition", () => {
  it("accepts an option whose default is one of its choices", () => {
    expect(optionSchema.safeParse(option).success).toBe(true);
  });

  it("rejects a default that is not a choice", () => {
    expect(optionSchema.safeParse({ ...option, defaultChoice: "band-collar" }).success).toBe(false);
  });

  it("rejects an option with no choices or repeated choices", () => {
    expect(optionSchema.safeParse({ ...option, choices: [] }).success).toBe(false);
    const twice = [option.choices[0], option.choices[0]];
    expect(optionSchema.safeParse({ ...option, choices: twice }).success).toBe(false);
  });
});

describe("help text", () => {
  it("lets an option and its choices carry a short help sentence", () => {
    const helped = {
      id: "placket",
      label: "Placket",
      help: "The strip that fastens the neck opening.",
      choices: [{ id: "zip", label: "Zip", help: "A zip runs down the strip." }],
      defaultChoice: "zip",
    };
    expect(optionSchema.parse(helped).help).toBe("The strip that fastens the neck opening.");
  });
});

describe("point of measure definition", () => {
  const point = {
    id: "chest-width",
    label: "Chest width",
    howToMeasure: "Lay the garment flat.",
    group: "body",
    appliesWhen: [],
  };

  it("accepts a point that always applies", () => {
    expect(pointOfMeasureSchema.safeParse(point).success).toBe(true);
  });

  it("requires a reason when a point applies only sometimes", () => {
    const conditional = { ...point, appliesWhen: [{ option: "collar", in: ["polo-collar"] }] };
    expect(pointOfMeasureSchema.safeParse(conditional).success).toBe(false);
    const explained = { ...conditional, unavailableReason: "There is no collar." };
    expect(pointOfMeasureSchema.safeParse(explained).success).toBe(true);
  });

  it("requires a known group", () => {
    expect(pointOfMeasureSchema.safeParse({ ...point, group: "legs" }).success).toBe(false);
    const without = Object.fromEntries(Object.entries(point).filter(([key]) => key !== "group"));
    expect(pointOfMeasureSchema.safeParse(without).success).toBe(false);
  });

  it("requires a how to measure sentence", () => {
    expect(pointOfMeasureSchema.safeParse({ ...point, howToMeasure: " " }).success).toBe(false);
  });
});

describe("panel and rule definitions", () => {
  it("accepts a panel with anchors and a panel without", () => {
    const base = { id: "body-front", label: "Body front", appliesWhen: [] };
    expect(panelSchema.safeParse({ ...base, anchors: [{ id: "centre-chest", label: "Centre chest" }] }).success).toBe(true);
    expect(panelSchema.safeParse({ ...base, anchors: [] }).success).toBe(true);
  });

  it("requires a rule to name at least one condition and give a reason", () => {
    const rule = { id: "r", when: [{ option: "a", in: ["b"] }], reason: "Because." };
    expect(ruleSchema.safeParse(rule).success).toBe(true);
    expect(ruleSchema.safeParse({ ...rule, when: [] }).success).toBe(false);
    expect(ruleSchema.safeParse({ ...rule, reason: "" }).success).toBe(false);
  });
});

describe("garment type definition", () => {
  const type = {
    id: "crew-tee",
    family: "tops",
    label: "Crew tee",
    wearers: ["men", "women"],
    options: [{ option: "collar", choices: ["none"], default: "none" }],
    pointsOfMeasure: ["chest-width"],
    panels: ["body-front"],
  };

  it("accepts a type", () => {
    expect(garmentTypeSchema.safeParse(type).success).toBe(true);
  });

  it("rejects a type with no wearers, a repeated wearer or an unknown family", () => {
    expect(garmentTypeSchema.safeParse({ ...type, wearers: [] }).success).toBe(false);
    expect(garmentTypeSchema.safeParse({ ...type, wearers: ["men", "men"] }).success).toBe(false);
    expect(garmentTypeSchema.safeParse({ ...type, family: "hats" }).success).toBe(false);
  });

  it("rejects a narrowed option whose default is not among its choices", () => {
    const bad = { ...type, options: [{ option: "collar", choices: ["none"], default: "polo-collar" }] };
    expect(garmentTypeSchema.safeParse(bad).success).toBe(false);
  });
});
