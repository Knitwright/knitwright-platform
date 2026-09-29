import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { pointsOfMeasureFor } from "./applicability";
import { checkCombination } from "./combinations";
import { allCombinations } from "./fixtures/combinations";
import { WEARERS } from "./primitives";
import { getType, listTypes } from "./registry";
import { createSpec, validateSpec, type GarmentSpec } from "./spec";

const FILE_ID = "3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11";

function start(typeId: string, wearer: "men" | "women" | "youth" = "women"): GarmentSpec {
  const result = createSpec(typeId, wearer);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
}

/** A plain copy that tests can change, since real specs are frozen. */
const copy = (spec: GarmentSpec): Record<string, unknown> => JSON.parse(JSON.stringify(spec));

function problems(input: unknown): string[] {
  const result = validateSpec(input);
  return result.ok ? [] : [...result.issues];
}

describe("createSpec", () => {
  it("makes a valid spec for every tops type and every wearer", () => {
    for (const { id } of listTypes("tops")) {
      for (const wearer of WEARERS) {
        const result = createSpec(id, wearer);
        expect(result.ok).toBe(true);
        expect(validateSpec(result.ok ? result.spec : null).ok).toBe(true);
      }
    }
  });

  it("chooses the default for every option and starts empty", () => {
    const spec = start("polo", "men");
    expect(spec.schemaVersion).toBe(2);
    expect(spec.typeId).toBe("polo");
    expect(spec.wearer).toBe("men");
    expect(spec.options).toEqual({
      fit: "regular",
      neckline: "crew",
      collar: "polo-collar",
      placket: "buttons",
      "sleeve-type": "set-in",
      "sleeve-length": "short",
      "hem-shape": "straight",
      "side-panels": "none",
      cuffs: "none",
    });
    expect(spec.measurements).toEqual([]);
    expect(spec.artwork).toEqual([]);
    expect(spec.fabrics).toEqual([
      {
        id: "main",
        name: "Main fabric",
        composition: "",
        construction: "",
        weightGsm: null,
        finish: "",
        stretch: "not-set",
        provenance: "user-edited",
      },
    ]);
    expect(spec.panelFabrics).toEqual([]);
    expect(spec.colourways).toHaveLength(1);
    expect(spec.colourways[0]?.colours).toEqual([]);
  });

  it("returns a frozen spec", () => {
    expect(Object.isFrozen(start("crew-tee"))).toBe(true);
  });

  it("refuses an unknown type", () => {
    expect(createSpec("kilt", "men")).toEqual({
      ok: false,
      reason: "There is no garment type called kilt.",
    });
  });

  it("refuses a wearer that is not one of the three", () => {
    const result = createSpec("polo", "kids" as never);
    expect(result.ok).toBe(false);
  });
});

describe("validateSpec", () => {
  it("accepts a spec with measurements, a fabric, colours and artwork", () => {
    const spec = copy(start("polo"));
    spec.measurements = [
      { pointId: "chest-width", value: 5200, provenance: "user-edited" },
      { pointId: "collar-height", value: 800, provenance: "brand-supplied" },
    ];
    spec.colourways = [
      { id: "main", name: "Home", colours: [{ panelId: "collar", colour: "navy" }] },
    ];
    spec.artwork = [
      {
        id: "logo",
        source: { kind: "file", fileId: FILE_ID },
        panelId: "body-front",
        anchor: "left-chest",
        offsetX: 0,
        offsetY: 0,
        width: 800,
        height: 800,
        technique: "embroidery",
      },
    ];
    expect(problems(spec)).toEqual([]);
  });

  it("accepts a spec with no measurements", () => {
    expect(validateSpec(start("crew-tee")).ok).toBe(true);
  });

  it("returns a frozen spec after parsing", () => {
    const result = validateSpec(copy(start("crew-tee")));
    expect(result.ok && Object.isFrozen(result.spec)).toBe(true);
  });

  it("rejects things that are not specs", () => {
    for (const input of [null, undefined, 3, "polo", [], {}]) {
      expect(validateSpec(input).ok).toBe(false);
    }
  });

  it("rejects a type that does not exist", () => {
    const spec = { ...copy(start("crew-tee")), typeId: "kilt" };
    expect(problems(spec)).toEqual(["There is no garment type called kilt."]);
  });

  it("rejects a spec that stores something that can be worked out, such as its panels", () => {
    const spec = { ...copy(start("crew-tee")), panels: ["body-front"] };
    expect(validateSpec(spec).ok).toBe(false);
  });

  it("rejects an option with no choice made", () => {
    const spec = copy(start("crew-tee"));
    const rest = Object.fromEntries(
      Object.entries(spec.options as Record<string, string>).filter(([key]) => key !== "neckline"),
    );
    expect(problems({ ...spec, options: rest })).toEqual(["Choose a value for Neckline shape."]);
  });

  it("rejects a choice the type does not offer", () => {
    const spec = copy(start("crew-tee"));
    const options = { ...(spec.options as Record<string, string>), neckline: "v-neck" };
    expect(problems({ ...spec, options })).toEqual([
      "V neck is not offered for Neckline shape on Crew neck tee.",
    ]);
  });

  it("rejects an option that does not apply to the type", () => {
    const spec = copy(start("crew-tee"));
    const options = { ...(spec.options as Record<string, string>), placket: "buttons" };
    expect(problems({ ...spec, options })).toEqual([
      "The option placket does not apply to Crew neck tee.",
    ]);
  });

  it("rejects an impossible combination and gives its reason", () => {
    const spec = copy(start("polo"));
    const options = { ...(spec.options as Record<string, string>), placket: "none" };
    expect(problems({ ...spec, options })).toEqual([
      "A polo collar folds open at the front, so it needs a placket to fasten the opening.",
    ]);
  });

  it("rejects a collar height on a tee with no collar and says why", () => {
    const spec = {
      ...copy(start("crew-tee")),
      measurements: [{ pointId: "collar-height", value: 800, provenance: "user-edited" }],
    };
    expect(problems(spec)).toEqual(["This garment has no collar, so there is no collar height to measure."]);
  });

  it("rejects a shoulder width on a raglan jersey", () => {
    const base = copy(start("team-jersey"));
    const options = { ...(base.options as Record<string, string>), "sleeve-type": "raglan" };
    const spec = {
      ...base,
      options,
      measurements: [{ pointId: "shoulder-width", value: 4000, provenance: "user-edited" }],
    };
    expect(problems(spec)[0]).toMatch(/no shoulder seam/);
  });

  it("rejects a measurement for a point the type does not have", () => {
    const spec = {
      ...copy(start("crew-tee")),
      measurements: [{ pointId: "inseam", value: 800, provenance: "user-edited" }],
    };
    expect(problems(spec)).toEqual(["inseam is not a point of measure for Crew neck tee."]);
  });

  it("rejects a point of measure that appears twice", () => {
    const entry = { pointId: "chest-width", value: 5200, provenance: "user-edited" };
    const spec = { ...copy(start("crew-tee")), measurements: [entry, { ...entry, value: 5300 }] };
    expect(problems(spec)).toEqual(["chest-width is listed more than once."]);
  });

  it("rejects a measurement with no provenance", () => {
    const spec = { ...copy(start("crew-tee")), measurements: [{ pointId: "chest-width", value: 5200 }] };
    expect(validateSpec(spec).ok).toBe(false);
  });

  it("rejects no colourways, a repeated colourway id and a colour for a panel the garment lacks", () => {
    const base = copy(start("crew-tee"));
    expect(validateSpec({ ...base, colourways: [] }).ok).toBe(false);
    const one = { id: "main", name: "Home", colours: [] };
    expect(problems({ ...base, colourways: [one, one] })).toEqual([
      "The colourway id main is used more than once.",
    ]);
    const stray = { ...one, colours: [{ panelId: "collar", colour: "navy" }] };
    expect(problems({ ...base, colourways: [stray] })).toEqual([
      "Colourway Home has a colour for collar, which this garment does not have.",
    ]);
  });

  it("rejects artwork on a panel that is missing, has no anchors or lacks that anchor", () => {
    const base = copy(start("crew-tee"));
    const art = {
      id: "logo",
      source: { kind: "text", text: "CLUB" },
      panelId: "body-front",
      anchor: "centre-chest",
      offsetX: 0,
      offsetY: 0,
      width: 500,
      height: 500,
      technique: "transfer",
    };
    const check = (patch: object): string[] => problems({ ...base, artwork: [{ ...art, ...patch }] });
    expect(check({ panelId: "collar" })).toEqual([
      "Artwork logo is on collar, which this garment does not have.",
    ]);
    expect(check({ panelId: "neckband" })).toEqual([
      "Artwork logo is on Neckband, which cannot carry artwork.",
    ]);
    expect(check({ anchor: "upper-back" })).toEqual([
      "Artwork logo uses upper-back, which is not a place on Body front.",
    ]);
    expect(problems({ ...base, artwork: [art, art] })).toEqual([
      "The artwork id logo is used more than once.",
    ]);
  });

  it("rejects a spec with the old single fabric field", () => {
    const spec = { ...copy(start("crew-tee")), fabric: {} };
    expect(validateSpec(spec).ok).toBe(false);
  });

  it("rejects no fabrics, a repeated fabric id and a fabric with no provenance", () => {
    const base = copy(start("crew-tee"));
    const fabrics = base.fabrics as Record<string, unknown>[];
    expect(validateSpec({ ...base, fabrics: [] }).ok).toBe(false);
    expect(problems({ ...base, fabrics: [fabrics[0], fabrics[0]] })).toEqual([
      "The fabric id main is used more than once.",
    ]);
    const bare = Object.fromEntries(Object.entries(fabrics[0] ?? {}).filter(([key]) => key !== "provenance"));
    expect(validateSpec({ ...base, fabrics: [bare] }).ok).toBe(false);
  });

  it("checks the panel to fabric assignments", () => {
    const base = copy(start("crew-tee"));
    const first = (base.fabrics as object[])[0];
    const fabrics = [first, { ...first, id: "mesh", name: "Mesh" }];
    const check = (panelFabrics: object[]): string[] => problems({ ...base, fabrics, panelFabrics });
    expect(check([{ panelId: "sleeve-left", fabricId: "mesh" }])).toEqual([]);
    expect(check([{ panelId: "collar", fabricId: "mesh" }])).toEqual([
      "The fabric assignment for collar names a panel this garment does not have.",
    ]);
    expect(check([{ panelId: "sleeve-left", fabricId: "wool" }])).toEqual([
      "The fabric assignment for sleeve-left names the fabric wool, which does not exist.",
    ]);
    const twice = { panelId: "sleeve-left", fabricId: "mesh" };
    expect(check([twice, twice])).toEqual(["The panel sleeve-left has more than one fabric."]);
  });

  it("agrees with checkCombination on every combination of choices every type offers", () => {
    for (const { id } of listTypes("tops")) {
      const base = copy(start(id));
      for (const options of allCombinations(id)) {
        const impossible = checkCombination(id, options).length > 0;
        expect(validateSpec({ ...base, options }).ok).toBe(!impossible);
      }
    }
  });

  it("accepts any subset of the applicable points and rejects any point that does not apply", () => {
    const type = getType("team-jersey");
    const all = (type?.pointsOfMeasure ?? []).map((point) => point.id);
    fc.assert(
      fc.property(
        fc.constantFrom(...allCombinations("team-jersey")),
        fc.subarray(all),
        fc.integer({ min: 1, max: 30_000 }),
        (options, chosen, value) => {
          if (checkCombination("team-jersey", options).length > 0) return;
          const applicable = pointsOfMeasureFor({ typeId: "team-jersey", options }).map((p) => p.id);
          const measurements = chosen.map((pointId) => ({ pointId, value, provenance: "derived" }));
          const spec = { ...copy(start("team-jersey")), options, measurements };
          expect(validateSpec(spec).ok).toBe(chosen.every((id) => applicable.includes(id)));
        },
      ),
    );
  });
});
