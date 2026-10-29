import { describe, expect, it } from "vitest";
import { applyAction } from "./apply-action";
import { accepted, fabric, rejected, setOption, start } from "./fixtures/specs";
import { migrateSpec, repairSpec } from "./repair";
import { MAX_COMPONENTS, MAX_CONSTRUCTION, SPEC_SCHEMA_VERSION, garmentSpecStructureSchema } from "./spec-schema";
import { validateSpec } from "./spec";

const component = (id: string, patch: object = {}) => ({
  id,
  name: "Polyester thread",
  details: "Tex 30, matched to the main colour",
  quantity: "1 cone",
  provenance: "user-edited",
  ...patch,
});
const setComponent = (id: string, patch: object = {}) => ({ type: "set-component", component: component(id, patch) });

const entry = (seamId: string, patch: object = {}) => ({
  seamId,
  seamClass: "lapped",
  stitchClass: "lockstitch",
  stitchDensity: "12 stitches per inch",
  provenance: "user-edited",
  ...patch,
});
const setConstruction = (seamId: string, patch: object = {}) => ({ type: "set-construction", entry: entry(seamId, patch) });

const label = (field: string, text: string) => ({ type: "set-labelling", field, text, provenance: "user-edited" });

describe("the design version", () => {
  it("is version 7", () => {
    expect(SPEC_SCHEMA_VERSION).toBe(7);
  });

  it("starts with no components, no construction overrides and no labelling", () => {
    const spec = start("crew-tee");
    expect(spec.components).toEqual([]);
    expect(spec.construction).toEqual([]);
    expect(spec.labelling).toEqual({});
    expect(spec.fabrics[0].consumption).toBe("");
  });
});

describe("migrating a version 4 design", () => {
  const version4 = (typeId: string): Record<string, unknown> => {
    const plain = JSON.parse(JSON.stringify(start(typeId))) as Record<string, unknown>;
    const { components, construction, labelling, ...rest } = plain;
    void components;
    void construction;
    void labelling;
    const fabrics = (rest.fabrics as Record<string, unknown>[]).map(({ consumption, ...others }) => {
      void consumption;
      return others;
    });
    return { ...rest, fabrics, schemaVersion: 4 };
  };

  it("adds empty components, construction and labelling and an empty consumption for every fabric", () => {
    const result = migrateSpec(version4("polo"));
    if (!result.ok) throw new Error(result.reason);
    expect(result.spec.schemaVersion).toBe(7);
    expect(result.spec.components).toEqual([]);
    expect(result.spec.construction).toEqual([]);
    expect(result.spec.labelling).toEqual({});
    expect(result.spec.fabrics.map((item) => item.consumption)).toEqual([""]);
    expect(result.stale).toBe(false);
  });

  it("keeps everything else in the design as it was", () => {
    const old = version4("polo");
    const result = migrateSpec({
      ...old,
      measurements: [{ pointId: "chest-width", value: 5200, provenance: "user-edited" }],
    });
    if (!result.ok) throw new Error(result.reason);
    expect(result.spec.measurements).toEqual([{ pointId: "chest-width", value: 5200, provenance: "user-edited" }]);
    expect(result.spec.options).toEqual((old.options as object));
  });

  it("does not overwrite fields a design already has", () => {
    const old = { ...version4("polo"), components: [component("main-thread")] };
    const result = migrateSpec(old);
    if (!result.ok) throw new Error(result.reason);
    expect(result.spec.components).toHaveLength(1);
  });
});

describe("fabric consumption", () => {
  it("is free text that the user types, empty until then", () => {
    const withConsumption = accepted(
      applyAction(start("crew-tee"), { type: "update-fabric", fabric: fabric("main", { consumption: "1.4 m per garment" }) }),
    ).spec;
    expect(withConsumption.fabrics[0].consumption).toBe("1.4 m per garment");
  });

  it("is filled in as empty when a browser sends a fabric without it", () => {
    const result = accepted(applyAction(start("crew-tee"), { type: "update-fabric", fabric: fabric("main") })).spec;
    expect(result.fabrics[0].consumption).toBe("");
  });

  it("refuses text with a line break", () => {
    expect(rejected(applyAction(start("crew-tee"), { type: "update-fabric", fabric: fabric("main", { consumption: "1\n2" }) }))).toBe(
      "That change is not understood.",
    );
  });
});

describe("set-component and remove-component", () => {
  it("describes something the design implies, and does not change the original", () => {
    const before = start("crew-tee");
    const after = accepted(applyAction(before, setComponent("main-thread"))).spec;
    expect(after.components).toEqual([component("main-thread")]);
    expect(before.components).toEqual([]);
  });

  it("replaces an entry with the same id instead of adding a second", () => {
    const first = accepted(applyAction(start("crew-tee"), setComponent("main-thread"))).spec;
    const second = accepted(applyAction(first, setComponent("main-thread", { quantity: "2 cones" }))).spec;
    expect(second.components).toHaveLength(1);
    expect(second.components[0]?.quantity).toBe("2 cones");
  });

  it("takes a quantity as free text with its unit, and lets it stay empty", () => {
    const spec = accepted(applyAction(start("crew-tee"), setComponent("brand-label", { quantity: "" }))).spec;
    expect(spec.components[0]?.quantity).toBe("");
  });

  it("refuses a component the garment does not imply, in plain words", () => {
    expect(rejected(applyAction(start("crew-tee"), setComponent("buttons")))).toBe(
      "Buttons does not apply to this garment.",
    );
    expect(rejected(applyAction(start("crew-tee"), setComponent("mystery")))).toBe(
      "mystery is not a component of Crew neck tee.",
    );
  });

  it("refuses an entry that says nothing", () => {
    const empty = { name: "", details: "", quantity: "" };
    expect(rejected(applyAction(start("crew-tee"), setComponent("main-thread", empty)))).toBe(
      "That change is not understood.",
    );
  });

  it("accepts an entry that only says the part is used, and refuses one that is both used and not used", () => {
    const empty = { name: "", details: "", quantity: "" };
    const spec = accepted(applyAction(start("crew-tee"), setComponent("main-thread", { ...empty, used: true }))).spec;
    expect(spec.components[0]).toMatchObject({ id: "main-thread", used: true, name: "" });
    expect(rejected(applyAction(start("crew-tee"), setComponent("main-thread", { ...empty, used: true, notUsed: true })))).toBe(
      "That change is not understood.",
    );
  });

  it("refuses text that is too long and text with a line break", () => {
    expect(rejected(applyAction(start("crew-tee"), setComponent("main-thread", { details: "x".repeat(300) })))).toBe(
      "That change is not understood.",
    );
    expect(rejected(applyAction(start("crew-tee"), setComponent("main-thread", { name: "a\nb" })))).toBe(
      "That change is not understood.",
    );
  });

  it("removes an entry, and refuses to remove one that is not there", () => {
    const first = accepted(applyAction(start("crew-tee"), setComponent("main-thread"))).spec;
    expect(accepted(applyAction(first, { type: "remove-component", id: "main-thread" })).spec.components).toEqual([]);
    expect(rejected(applyAction(start("crew-tee"), { type: "remove-component", id: "main-thread" }))).toBe(
      "There is no component with the id main-thread.",
    );
  });

  it("drops the details of buttons when the placket becomes a zip, and says so", () => {
    const buttoned = accepted(applyAction(start("polo"), setComponent("buttons", { name: "Shell buttons" }))).spec;
    const result = accepted(applyAction(buttoned, setOption("placket", "zip")));
    expect(result.spec.components).toEqual([]);
    expect(result.dropped.map((item) => [item.kind, item.id])).toEqual([["component", "buttons"]]);
    expect(result.dropped[0]?.message).toBe("The details for Buttons were removed, because this garment no longer has them.");
  });

  it("keeps the details of thread and labels through any change of options", () => {
    const withThread = accepted(applyAction(start("polo"), setComponent("main-thread"))).spec;
    const result = accepted(applyAction(withThread, setOption("placket", "zip")));
    expect(result.spec.components.map((item) => item.id)).toEqual(["main-thread"]);
  });
});

describe("set-construction and remove-construction", () => {
  it("overrides the classes and sets a stitch density, and does not change the original", () => {
    const before = start("crew-tee");
    const after = accepted(applyAction(before, setConstruction("body-hem"))).spec;
    expect(after.construction).toEqual([entry("body-hem")]);
    expect(before.construction).toEqual([]);
  });

  it("allows a stitch density alone, with the classes left to the registry", () => {
    const spec = accepted(
      applyAction(start("crew-tee"), setConstruction("body-hem", { seamClass: undefined, stitchClass: undefined })),
    ).spec;
    expect(spec.construction[0]?.seamClass).toBeUndefined();
    expect(spec.construction[0]?.stitchDensity).toBe("12 stitches per inch");
  });

  it("replaces the entry for the same seam", () => {
    const first = accepted(applyAction(start("crew-tee"), setConstruction("body-hem"))).spec;
    const second = accepted(applyAction(first, setConstruction("body-hem", { stitchDensity: "10 stitches per inch" }))).spec;
    expect(second.construction).toHaveLength(1);
    expect(second.construction[0]?.stitchDensity).toBe("10 stitches per inch");
  });

  it("refuses an entry that changes nothing", () => {
    const nothing = { seamClass: undefined, stitchClass: undefined, stitchDensity: "" };
    expect(rejected(applyAction(start("crew-tee"), setConstruction("body-hem", nothing)))).toBe(
      "That change is not understood.",
    );
  });

  it("refuses a seam the garment does not have", () => {
    expect(rejected(applyAction(start("crew-tee"), setConstruction("zip-seam")))).toBe(
      "Zip seam does not apply to this garment.",
    );
    expect(rejected(applyAction(start("crew-tee"), setConstruction("nonsense")))).toBe(
      "nonsense is not a seam of Crew neck tee.",
    );
  });

  it("refuses a class that is not in the catalogue", () => {
    expect(rejected(applyAction(start("crew-tee"), setConstruction("body-hem", { seamClass: "glued" })))).toBe(
      "glued is not a seam class.",
    );
    expect(rejected(applyAction(start("crew-tee"), setConstruction("body-hem", { stitchClass: "glued" })))).toBe(
      "glued is not a stitch class.",
    );
  });

  it("removes an override, and refuses to remove one that is not there", () => {
    const first = accepted(applyAction(start("crew-tee"), setConstruction("body-hem"))).spec;
    expect(accepted(applyAction(first, { type: "remove-construction", seamId: "body-hem" })).spec.construction).toEqual([]);
    expect(rejected(applyAction(start("crew-tee"), { type: "remove-construction", seamId: "body-hem" }))).toBe(
      "There is no construction entry for body-hem.",
    );
  });

  it("drops an override when its seam goes away, and says so", () => {
    const withVent = accepted(applyAction(start("polo"), setOption("hem-shape", "side-vent"))).spec;
    const withEntry = accepted(applyAction(withVent, setConstruction("side-vent-seam"))).spec;
    const result = accepted(applyAction(withEntry, setOption("hem-shape", "straight")));
    expect(result.spec.construction).toEqual([]);
    expect(result.dropped.map((item) => [item.kind, item.id])).toEqual([["construction", "side-vent-seam"]]);
    expect(result.dropped[0]?.message).toBe(
      "The stitch details for Side vent finish were removed, because this garment no longer has that seam.",
    );
  });
});

describe("set-labelling", () => {
  it("sets care, composition, origin, fold and bag, each with its source", () => {
    let spec = start("crew-tee");
    for (const field of ["care", "composition", "origin", "fold", "bag"]) {
      spec = accepted(applyAction(spec, label(field, `Text for ${field}`))).spec;
    }
    expect(spec.labelling.care).toEqual({ text: "Text for care", provenance: "user-edited" });
    expect(Object.keys(spec.labelling).sort()).toEqual(["bag", "care", "composition", "fold", "origin"]);
  });

  it("removes a field when the text is emptied", () => {
    const set = accepted(applyAction(start("crew-tee"), label("care", "Wash cold"))).spec;
    const cleared = accepted(applyAction(set, label("care", ""))).spec;
    expect(cleared.labelling).toEqual({});
  });

  it("refuses a field it does not know, and text with a line break", () => {
    expect(rejected(applyAction(start("crew-tee"), label("price", "cheap")))).toBe("That change is not understood.");
    expect(rejected(applyAction(start("crew-tee"), label("care", "a\nb")))).toBe("That change is not understood.");
  });

  it("carries a source that is not typed by the user when a trusted writer sets it", () => {
    const spec = accepted(
      applyAction(start("crew-tee"), { type: "set-labelling", field: "origin", text: "Portugal", provenance: "ai-suggested" }),
    ).spec;
    expect(spec.labelling.origin?.provenance).toBe("ai-suggested");
  });
});

describe("validating a stored design", () => {
  const plain = (): Record<string, unknown> => JSON.parse(JSON.stringify(start("crew-tee"))) as Record<string, unknown>;

  it("refuses two entries for one component or one seam", () => {
    const twice = { ...plain(), components: [component("main-thread"), component("main-thread")] };
    const result = validateSpec(twice);
    expect(result.ok).toBe(false);
    const seams = { ...plain(), construction: [entry("body-hem"), entry("body-hem")] };
    expect(validateSpec(seams).ok).toBe(false);
  });

  it("refuses unknown keys in labelling", () => {
    expect(validateSpec({ ...plain(), labelling: { price: { text: "x", provenance: "user-edited" } } }).ok).toBe(false);
  });

  it("repairs a design whose placket changed under it, by dropping the buttons", () => {
    const polo = JSON.parse(JSON.stringify(start("polo"))) as Record<string, unknown>;
    const stale = migrateSpec({
      ...polo,
      options: { ...(polo.options as object), placket: { choiceId: "zip", provenance: "user-edited" } },
      components: [component("buttons")],
    });
    if (!stale.ok) throw new Error(stale.reason);
    expect(stale.stale).toBe(true);
    const repaired = repairSpec(stale.spec);
    if (!repaired.ok) throw new Error(repaired.reason);
    expect(repaired.spec.components).toEqual([]);
  });
});

describe("limits", () => {
  it("are the ones the design contract names: 24 components and 32 construction entries", () => {
    expect(MAX_COMPONENTS).toBe(24);
    expect(MAX_CONSTRUCTION).toBe(32);
  });

  it("accepts a quantity of exactly the longest length and refuses one character more", () => {
    const at = (length: number) => applyAction(start("crew-tee"), setComponent("main-thread", { quantity: "x".repeat(length) }));
    expect(at(60).ok).toBe(true);
    expect(at(61).ok).toBe(false);
  });

  it("accepts a fabric consumption of exactly the longest length and refuses one character more", () => {
    const at = (length: number) =>
      applyAction(start("crew-tee"), { type: "change-fabric", id: "main", changes: { consumption: "x".repeat(length) }, provenance: "user-edited" });
    expect(at(60).ok).toBe(true);
    expect(at(61).ok).toBe(false);
  });

  it("accepts the most components and construction entries a design may hold, and refuses one more", () => {
    const plain = JSON.parse(JSON.stringify(start("crew-tee"))) as Record<string, unknown>;
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) => component(`slot-${index}`));
    const entries = (count: number) => Array.from({ length: count }, (_, index) => entry(`seam-${index}`));
    expect(garmentSpecStructureSchema.safeParse({ ...plain, components: many(MAX_COMPONENTS) }).success).toBe(true);
    expect(garmentSpecStructureSchema.safeParse({ ...plain, components: many(MAX_COMPONENTS + 1) }).success).toBe(false);
    expect(garmentSpecStructureSchema.safeParse({ ...plain, construction: entries(MAX_CONSTRUCTION) }).success).toBe(true);
    expect(garmentSpecStructureSchema.safeParse({ ...plain, construction: entries(MAX_CONSTRUCTION + 1) }).success).toBe(false);
  });

  it("holds the source of each label field, so a suggestion stays a suggestion", () => {
    const spec = accepted(applyAction(start("crew-tee"), { type: "set-labelling", field: "fold", text: "In three", provenance: "read-from-image" })).spec;
    expect(spec.labelling.fold?.provenance).toBe("read-from-image");
  });

  it("marks a part as not used only with no details, and needs details otherwise", () => {
    const notUsed = (patch: object) => applyAction(start("crew-tee"), setComponent("brand-label", { name: "", details: "", quantity: "", notUsed: true, ...patch }));
    expect(notUsed({}).ok).toBe(true);
    expect(notUsed({ name: "Woven" }).ok).toBe(false);
    expect(applyAction(start("crew-tee"), setComponent("brand-label", { name: "", details: "", quantity: "" })).ok).toBe(false);
  });
});

