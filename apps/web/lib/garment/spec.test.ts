import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { pointsOfMeasureFor } from "./applicability";
import { checkCombination } from "./combinations";
import { allCombinations } from "./fixtures/combinations";
import { start } from "./fixtures/specs";
import { WEARERS } from "./primitives";
import { getType, listTypes } from "./registry";
import { createSpec, validateSpec, type GarmentSpec } from "./spec";

const FILE_ID = "3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11";
const chose = (choiceId: string) => ({ choiceId, provenance: "user-edited" });

/** A plain copy that tests can change, since real specs are frozen. */
const copy = (spec: GarmentSpec): Record<string, unknown> => JSON.parse(JSON.stringify(spec));
const optionsOf = (spec: Record<string, unknown>): Record<string, unknown> => spec.options as Record<string, unknown>;

function problems(input: unknown): string[] {
  const result = validateSpec(input);
  return result.ok ? [] : [...result.issues];
}

const withOptions = (base: Record<string, unknown>, patch: Record<string, string>): Record<string, unknown> => ({
  ...base,
  options: { ...optionsOf(base), ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, chose(v)])) },
});

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

  it("chooses the default for every option, marked derived, and starts empty", () => {
    const spec = start("polo", "men");
    expect(spec.schemaVersion).toBe(6);
    expect(spec.typeId).toBe("polo");
    expect(spec.wearer).toBe("men");
    const derived = (choiceId: string) => ({ choiceId, provenance: "derived" });
    expect(spec.options).toEqual({
      fit: derived("regular"),
      neckline: derived("crew"),
      collar: derived("polo-collar"),
      placket: derived("buttons"),
      "sleeve-type": derived("set-in"),
      "sleeve-length": derived("short"),
      "hem-shape": derived("straight"),
      "side-panels": derived("none"),
      cuffs: derived("none"),
    });
    expect(spec.sizing).toBeNull();
    expect(spec.measurements).toEqual([]);
    expect(spec.artwork).toEqual([]);
    expect(spec.panelFabrics).toEqual([]);
    expect(spec.fabrics).toEqual([
      {
        id: "main",
        name: "Main fabric",
        composition: "",
        construction: "",
        weightGsm: null,
        finish: "",
        consumption: "",
        stretch: "not-set",
        provenance: "user-edited",
        sources: {},
      },
    ]);
    expect(spec.colourways).toHaveLength(1);
    expect(spec.colourways[0].colours).toEqual([]);
  });

  it("returns a frozen spec", () => {
    expect(Object.isFrozen(start("crew-tee"))).toBe(true);
  });

  it("refuses an unknown type", () => {
    expect(createSpec("kilt", "men")).toEqual({ ok: false, reason: "There is no garment type called kilt." });
  });

  it("refuses a wearer that is not one of the three", () => {
    expect(createSpec("polo", "kids" as never).ok).toBe(false);
  });
});

describe("validateSpec", () => {
  it("accepts a spec with measurements, fabrics, colours and artwork", () => {
    const spec = copy(start("polo"));
    spec.measurements = [
      { pointId: "chest-width", value: 5200, provenance: "user-edited" },
      { pointId: "collar-height", value: 800, provenance: "brand-supplied" },
    ];
    spec.colourways = [
      { id: "main", name: "Home", colours: [{ panelId: "collar", colour: "navy", provenance: "user-edited" }] },
    ];
    spec.artwork = [
      {
        id: "logo",
        name: "Crest",
        source: { kind: "file", fileId: FILE_ID },
        panelId: "body-front",
        anchor: "left-chest",
        offsetX: 0,
        offsetY: 0,
        width: 800,
        height: 800,
        technique: "embroidery",
        provenance: "user-edited",
      },
    ];
    expect(problems(spec)).toEqual([]);
  });

  it("returns a frozen spec after parsing", () => {
    const result = validateSpec(copy(start("crew-tee")));
    expect(result.ok && Object.isFrozen(result.spec)).toBe(true);
  });

  it("rejects things that are not specs", () => {
    for (const input of [null, undefined, 3, "polo", [], {}]) expect(validateSpec(input).ok).toBe(false);
  });

  it("rejects a type that does not exist", () => {
    const spec = { ...copy(start("crew-tee")), typeId: "kilt" };
    expect(problems(spec)).toEqual(["There is no garment type called kilt."]);
  });

  it("rejects a spec that stores something that can be worked out, such as its panels", () => {
    expect(validateSpec({ ...copy(start("crew-tee")), panels: ["body-front"] }).ok).toBe(false);
  });

  it("rejects an option with no choice made, one that is not offered, and one that does not apply", () => {
    const spec = copy(start("crew-tee"));
    const rest = Object.fromEntries(Object.entries(optionsOf(spec)).filter(([key]) => key !== "neckline"));
    expect(problems({ ...spec, options: rest })).toEqual(["Choose a value for Neckline."]);
    expect(problems(withOptions(spec, { neckline: "v-neck" }))).toEqual([
      "V neck is not offered for Neckline on Crew neck tee.",
    ]);
    expect(problems(withOptions(spec, { placket: "buttons" }))).toEqual([
      "The option placket does not apply to Crew neck tee.",
    ]);
  });

  it("rejects an option stored as a bare string or with no provenance", () => {
    const spec = copy(start("crew-tee"));
    expect(validateSpec({ ...spec, options: { ...optionsOf(spec), fit: "slim" } }).ok).toBe(false);
    expect(validateSpec({ ...spec, options: { ...optionsOf(spec), fit: { choiceId: "slim" } } }).ok).toBe(false);
  });

  it("says a choice is not offered, without quoting a rule, when the polo is given no placket", () => {
    const spec = withOptions(copy(start("polo")), { placket: "none" });
    expect(problems(spec)).toEqual(["No placket is not offered for Placket on Polo shirt."]);
  });

  it("reports the rule for a stored combination whose choices are all offered", () => {
    const spec = withOptions(copy(start("team-jersey")), { neckline: "v-neck", placket: "zip" });
    expect(problems(spec)).toEqual([
      "A V neck already opens down the chest, so there is no room for a placket. Choose no placket, or a round neck.",
    ]);
  });

  it("rejects a collar height on a tee with no collar and says why", () => {
    const spec = { ...copy(start("crew-tee")), measurements: [{ pointId: "collar-height", value: 800, provenance: "user-edited" }] };
    expect(problems(spec)).toEqual(["This garment has no collar, so there is no collar height to measure."]);
  });

  it("rejects a shoulder width on a raglan jersey", () => {
    const base = withOptions(copy(start("team-jersey")), { "sleeve-type": "raglan" });
    const spec = { ...base, measurements: [{ pointId: "shoulder-width", value: 4000, provenance: "user-edited" }] };
    expect(problems(spec)[0]).toMatch(/no shoulder seam/);
  });

  it("rejects an unknown measurement, a repeated one and one with no provenance", () => {
    const base = copy(start("crew-tee"));
    const entry = { pointId: "chest-width", value: 5200, provenance: "user-edited" };
    expect(problems({ ...base, measurements: [{ ...entry, pointId: "inseam" }] })).toEqual([
      "inseam is not a measurement for Crew neck tee.",
    ]);
    expect(problems({ ...base, measurements: [entry, { ...entry, value: 5300 }] })).toEqual([
      "Chest width is listed more than once.",
    ]);
    expect(validateSpec({ ...base, measurements: [{ pointId: "chest-width", value: 5200 }] }).ok).toBe(false);
  });

  it("rejects no colourways, a repeated colourway id and a colour for a panel the garment lacks", () => {
    const base = copy(start("crew-tee"));
    expect(problems({ ...base, colourways: [] })).toEqual(["Keep at least one colourway."]);
    const one = { id: "main", name: "Home", colours: [] };
    expect(problems({ ...base, colourways: [one, one] })).toEqual(["The colourway id main is used more than once."]);
    const stray = { ...one, colours: [{ panelId: "collar", colour: "navy", provenance: "user-edited" }] };
    expect(problems({ ...base, colourways: [stray] })).toEqual([
      "Colourway Home has a colour for Collar, which this garment does not have.",
    ]);
  });

  it("rejects too many fabrics or colourways", () => {
    const base = copy(start("crew-tee"));
    const fabric = (base.fabrics as object[])[0];
    const fabrics = Array.from({ length: 17 }, (_, index) => ({ ...fabric, id: `f${index}` }));
    expect(problems({ ...base, fabrics })).toEqual(["A design can have at most 16 fabrics."]);
    const colourways = Array.from({ length: 25 }, (_, index) => ({ id: `c${index}`, name: "C", colours: [] }));
    expect(problems({ ...base, colourways })).toEqual(["A design can have at most 24 colourways."]);
  });

  it("rejects no fabrics, a repeated fabric id and a fabric with no provenance", () => {
    const base = copy(start("crew-tee"));
    const fabrics = base.fabrics as Record<string, unknown>[];
    expect(problems({ ...base, fabrics: [] })).toEqual(["Keep at least one fabric."]);
    expect(problems({ ...base, fabrics: [fabrics[0], fabrics[0]] })).toEqual(["The fabric id main is used more than once."]);
    const bare = Object.fromEntries(Object.entries(fabrics[0] ?? {}).filter(([key]) => key !== "provenance"));
    expect(validateSpec({ ...base, fabrics: [bare] }).ok).toBe(false);
  });

  it("rejects the old single fabric field", () => {
    expect(validateSpec({ ...copy(start("crew-tee")), fabric: {} }).ok).toBe(false);
  });

  it("checks the panel to fabric assignments", () => {
    const base = copy(start("crew-tee"));
    const first = (base.fabrics as object[])[0];
    const fabrics = [first, { ...first, id: "mesh", name: "Mesh" }];
    const check = (panelFabrics: object[]): string[] => problems({ ...base, fabrics, panelFabrics });
    expect(check([{ panelId: "sleeve-left", fabricId: "mesh" }])).toEqual([]);
    expect(check([{ panelId: "collar", fabricId: "mesh" }])).toEqual([
      "The fabric assignment for Collar names a panel this garment does not have.",
    ]);
    expect(check([{ panelId: "sleeve-left", fabricId: "wool" }])).toEqual([
      "The fabric assignment for Left sleeve names a fabric that does not exist.",
    ]);
    const twice = { panelId: "sleeve-left", fabricId: "mesh" };
    expect(check([twice, twice])).toEqual(["Left sleeve has more than one fabric."]);
  });

  it("rejects artwork on a panel that is missing, has no anchors or lacks that anchor", () => {
    const base = copy(start("crew-tee"));
    const art = {
      id: "logo",
      name: "Crest",
      source: { kind: "text", text: "CLUB" },
      panelId: "body-front",
      anchor: "centre-chest",
      offsetX: 0,
      offsetY: 0,
      width: 500,
      height: 500,
      rotationDegrees: 0,
      technique: "transfer",
      provenance: "user-edited",
    };
    const check = (patch: object): string[] => problems({ ...base, artwork: [{ ...art, ...patch }] });
    expect(check({ panelId: "collar" })).toEqual(['Artwork "Crest" is on Collar, which this garment does not have.']);
    expect(check({ panelId: "neckband" })).toEqual(['Artwork "Crest" is on Neckband, which cannot carry artwork.']);
    expect(check({ anchor: "upper-back" })).toEqual([
      'Artwork "Crest" uses Upper back, which is not a place on Body front.',
    ]);
    expect(problems({ ...base, artwork: [art, art] })).toEqual(["The artwork id logo is used more than once."]);
  });

  it("agrees with checkCombination on every combination of choices every type offers", () => {
    for (const { id } of listTypes("tops")) {
      const base = copy(start(id));
      for (const options of allCombinations(id)) {
        const stored = Object.fromEntries(Object.entries(options).map(([key, value]) => [key, chose(value)]));
        const impossible = checkCombination(id, options).length > 0;
        expect(validateSpec({ ...base, options: stored }).ok).toBe(!impossible);
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
          const stored = Object.fromEntries(Object.entries(options).map(([key, id]) => [key, chose(id)]));
          const spec = { ...copy(start("team-jersey")), options: stored, measurements };
          expect(validateSpec(spec).ok).toBe(chosen.every((id) => applicable.includes(id)));
        },
      ),
    );
  });
});
