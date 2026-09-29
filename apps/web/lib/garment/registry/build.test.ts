import { describe, expect, it } from "vitest";
import type { FamilyData } from "../definitions";
import { buildRegistry, checkFamilyData } from "./build";

const family: FamilyData = {
  id: "tops",
  label: "Tops",
  options: [
    {
      id: "collar",
      label: "Collar",
      choices: [
        { id: "none", label: "No collar" },
        { id: "polo-collar", label: "Polo collar" },
      ],
      defaultChoice: "none",
    },
  ],
  pointsOfMeasure: [
    { id: "chest-width", label: "Chest width", howToMeasure: "Lay flat.", group: "body", appliesWhen: [] },
    {
      id: "collar-height",
      label: "Collar height",
      howToMeasure: "Measure the collar.",
      group: "neck",
      appliesWhen: [{ option: "collar", in: ["polo-collar"] }],
      unavailableReason: "There is no collar.",
    },
  ],
  panels: [{ id: "body-front", label: "Body front", appliesWhen: [], anchors: [] }],
  rules: [
    { id: "no-polo", when: [{ option: "collar", in: ["polo-collar"] }], reason: "Not here." },
  ],
  seams: [
    {
      id: "side-seam",
      label: "Side seam",
      panels: ["body-front"],
      appliesWhen: [],
      unlessWhen: [],
      seamClass: "superimposed",
      stitchClass: "lockstitch",
    },
  ],
  components: [
    {
      id: "main-thread",
      label: "Main thread",
      kind: "thread",
      help: "The thread.",
      appliesWhen: [],
      panels: ["body-front"],
      proposal: false,
    },
  ],
  types: [
    {
      id: "test-tee",
      family: "tops",
      label: "Test tee",
      wearers: ["men"],
      options: [{ option: "collar" }],
      pointsOfMeasure: ["chest-width", "collar-height"],
      panels: ["body-front"],
    },
  ],
};

const withType = (patch: Record<string, unknown>): FamilyData => ({
  ...family,
  types: [{ ...family.types[0], ...patch } as FamilyData["types"][number]],
});

describe("registry build", () => {
  it("finds no problem in sound data", () => {
    expect(checkFamilyData(family)).toEqual([]);
  });

  it("resolves a type with its full options, points and panels", () => {
    const registry = buildRegistry([family]);
    const type = registry.getType("test-tee");
    expect(type?.options[0]?.choices.map((choice) => choice.id)).toEqual(["none", "polo-collar"]);
    expect(type?.pointsOfMeasure.map((point) => point.id)).toEqual(["chest-width", "collar-height"]);
    expect(type?.rules).toHaveLength(1);
    expect(registry.getType("missing")).toBeUndefined();
  });

  it("narrows choices and changes the default for one type", () => {
    const narrowed = withType({ options: [{ option: "collar", choices: ["polo-collar"], default: "polo-collar" }] });
    const option = buildRegistry([{ ...narrowed, rules: [] }]).getType("test-tee")?.options[0];
    expect(option?.choices.map((choice) => choice.id)).toEqual(["polo-collar"]);
    expect(option?.defaultChoice).toBe("polo-collar");
  });

  it("reports narrowed choices whose default is not among them, instead of guessing", () => {
    const narrowed = withType({ options: [{ option: "collar", choices: ["polo-collar"] }] });
    expect(checkFamilyData(narrowed)).toEqual([
      'Type "test-tee" offers only "polo-collar" for "collar", but its default "none" is not among them. Set a default.',
    ]);
    expect(() => buildRegistry([narrowed])).toThrow(/Set a default/);
  });

  it("reports a default that is not a choice of the option", () => {
    const bad = withType({ options: [{ option: "collar", default: "band-collar" }] });
    expect(checkFamilyData(bad)).toEqual([
      'Type "test-tee" sets the default "band-collar" for "collar", which is not a choice.',
    ]);
  });

  it("reports an option, point of measure or panel listed twice in one type", () => {
    expect(checkFamilyData(withType({ options: [{ option: "collar" }, { option: "collar" }] }))).toEqual([
      'Type "test-tee" lists the option "collar" twice.',
    ]);
    expect(checkFamilyData(withType({ pointsOfMeasure: ["chest-width", "chest-width"] }))).toEqual([
      'Type "test-tee" lists the point of measure "chest-width" twice.',
    ]);
    expect(checkFamilyData(withType({ panels: ["body-front", "body-front"] }))).toEqual([
      'Type "test-tee" lists the panel "body-front" twice.',
    ]);
  });

  it("reports a type whose starting choices break its own rules", () => {
    const bad = withType({ options: [{ option: "collar", default: "polo-collar" }] });
    expect(checkFamilyData(bad)).toEqual([
      'Type "test-tee" starts with a combination that breaks the rule "no-polo". Not here.',
    ]);
  });

  it("reports a type that names an option, point or panel that does not exist", () => {
    expect(checkFamilyData(withType({ options: [{ option: "cuffs" }] }))).toEqual([
      'Type "test-tee" uses the unknown option "cuffs".',
    ]);
    expect(checkFamilyData(withType({ pointsOfMeasure: ["hem-width"] }))).toEqual([
      'Type "test-tee" uses the unknown point of measure "hem-width".',
    ]);
    expect(checkFamilyData(withType({ panels: ["hood"] }))).toEqual([
      'Type "test-tee" uses the unknown panel "hood".',
    ]);
  });

  it("reports a narrowed choice that the option does not have", () => {
    const problems = checkFamilyData(withType({ options: [{ option: "collar", choices: ["band-collar"], default: "none" }] }));
    expect(problems).toEqual(['Type "test-tee" offers "band-collar" for "collar", which is not a choice.']);
  });

  it("reports a condition or rule that names an unknown option or choice", () => {
    const bad: FamilyData = {
      ...family,
      rules: [{ id: "r1", when: [{ option: "hem", in: ["x"] }], reason: "No." }],
      panels: [
        {
          id: "body-front",
          label: "Body front",
          appliesWhen: [{ option: "collar", in: ["hood"] }],
          anchors: [],
        },
      ],
    };
    expect(checkFamilyData(bad)).toEqual([
      'Panel "body-front" checks "hood", which is not a choice of "collar".',
      'Rule "r1" checks the unknown option "hem".',
    ]);
  });

  it("reports repeated ids", () => {
    const twice: FamilyData = { ...family, panels: [...family.panels, ...family.panels] };
    expect(checkFamilyData(twice)).toEqual(['Panel id "body-front" is used twice.']);
  });

  it("throws when a family has a problem or two families share a type id", () => {
    expect(() => buildRegistry([withType({ panels: ["hood"] })])).toThrow(/unknown panel "hood"/);
    expect(() => buildRegistry([family, { ...family, id: "bottoms" }])).toThrow(/used twice/);
  });

  it("explains an unknown option in the error instead of failing on it", () => {
    expect(() => buildRegistry([withType({ options: [{ option: "cuffs" }] })])).toThrow(
      /unknown option "cuffs"/,
    );
  });

  it("throws on data that does not fit the schema", () => {
    expect(() => buildRegistry([{ ...family, label: "" }])).toThrow();
  });

  it("lists families and types, optionally for one family", () => {
    const registry = buildRegistry([family, { ...family, id: "bottoms", types: [] }]);
    expect(registry.listFamilies().map((entry) => entry.id)).toEqual(["tops", "bottoms"]);
    expect(registry.listTypes().map((entry) => entry.id)).toEqual(["test-tee"]);
    expect(registry.listTypes("bottoms")).toEqual([]);
    expect(registry.listTypes("tops")).toHaveLength(1);
  });

  describe("seams and components", () => {
    const seam = family.seams[0] as FamilyData["seams"][number];
    const slot = family.components[0] as FamilyData["components"][number];
    const withSeam = (patch: Record<string, unknown>): FamilyData => ({ ...family, seams: [{ ...seam, ...patch }] });
    const withSlot = (patch: Record<string, unknown>): FamilyData => ({ ...family, components: [{ ...slot, ...patch }] });

    it("resolves the seams and components onto the type", () => {
      const type = buildRegistry([family]).getType("test-tee");
      expect(type?.seams.map((entry) => entry.id)).toEqual(["side-seam"]);
      expect(type?.components.map((entry) => entry.id)).toEqual(["main-thread"]);
    });

    it("reports a seam that joins an unknown panel", () => {
      expect(checkFamilyData(withSeam({ panels: ["wing"] }))).toEqual(['Seam "side-seam" uses the unknown panel "wing".']);
    });

    it("reports a seam that lists a panel twice", () => {
      expect(checkFamilyData(withSeam({ panels: ["body-front", "body-front"] }))).toHaveLength(1);
    });

    it("reports a seam with an unknown seam class or stitch class", () => {
      expect(checkFamilyData(withSeam({ seamClass: "glued" }))).toEqual([
        'Seam "side-seam" uses the unknown seam class "glued".',
      ]);
      expect(checkFamilyData(withSeam({ stitchClass: "glued" }))).toEqual([
        'Seam "side-seam" uses the unknown stitch class "glued".',
      ]);
    });

    it("reports a seam condition or exclusion on an unknown option", () => {
      expect(checkFamilyData(withSeam({ appliesWhen: [{ option: "hood", in: ["x"] }] }))).toHaveLength(1);
      expect(checkFamilyData(withSeam({ unlessWhen: [{ option: "hood", in: ["x"] }] }))).toHaveLength(1);
    });

    it("reports a repeated seam or component id", () => {
      expect(checkFamilyData({ ...family, seams: [seam, seam] })).toEqual(['Seam id "side-seam" is used twice.']);
      expect(checkFamilyData({ ...family, components: [slot, slot] })).toEqual(['Component id "main-thread" is used twice.']);
    });

    it("reports a component with an unknown condition or panel", () => {
      expect(checkFamilyData(withSlot({ appliesWhen: [{ option: "hood", in: ["x"] }] }))).toHaveLength(1);
      expect(checkFamilyData(withSlot({ panels: ["wing"] }))).toEqual(['Component "main-thread" uses the unknown panel "wing".']);
    });
  });
});
