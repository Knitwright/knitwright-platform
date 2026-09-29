import { describe, expect, it } from "vitest";
import { applyAction } from "./apply-action";
import { accepted, fabric, rejected, start } from "./fixtures/specs";
import { migrateSpec } from "./repair";
import { SPEC_SCHEMA_VERSION } from "./spec-schema";

const suggested = () =>
  accepted(
    applyAction(start("crew-tee"), {
      type: "update-fabric",
      fabric: fabric("main", { name: "Interlock", composition: "Cotton", provenance: "ai-suggested", weightGsm: 180 }),
    }),
  ).spec;

describe("the design version", () => {
  it("is version 6", () => {
    expect(SPEC_SCHEMA_VERSION).toBe(6);
  });
});

describe("the source of each fabric field", () => {
  it("gives every field that has a value its own source, and leaves the others without one", () => {
    const main = suggested().fabrics[0];
    expect(main.sources).toEqual({ composition: "ai-suggested", weightGsm: "ai-suggested", stretch: "ai-suggested" });
    expect(main.sources).not.toHaveProperty("finish");
    expect(main.sources).not.toHaveProperty("consumption");
  });

  it("keeps a source that a trusted writer gave a field", () => {
    const spec = accepted(
      applyAction(start("crew-tee"), {
        type: "update-fabric",
        fabric: fabric("main", { composition: "Cotton", provenance: "user-edited", sources: { composition: "read-from-image" } }),
      }),
    ).spec;
    expect(spec.fabrics[0].sources.composition).toBe("read-from-image");
  });
});

describe("change-fabric", () => {
  const change = (changes: object, provenance = "user-edited") => ({ type: "change-fabric", id: "main", changes, provenance });

  it("changes only the fields listed and gives only those the new source", () => {
    const after = accepted(applyAction(suggested(), change({ consumption: "1.2 m" }))).spec.fabrics[0];
    expect(after.consumption).toBe("1.2 m");
    expect(after.composition).toBe("Cotton");
    expect(after.sources).toEqual({
      composition: "ai-suggested",
      weightGsm: "ai-suggested",
      stretch: "ai-suggested",
      consumption: "user-edited",
    });
  });

  it("marks a field the user changes as theirs and leaves the untouched ones as they were", () => {
    const after = accepted(applyAction(suggested(), change({ composition: "Cotton and elastane" }))).spec.fabrics[0];
    expect(after.sources.composition).toBe("user-edited");
    expect(after.sources.weightGsm).toBe("ai-suggested");
  });

  it("takes the source away from a field that is emptied", () => {
    const after = accepted(applyAction(suggested(), change({ composition: "", weightGsm: null }))).spec.fabrics[0];
    expect(after.composition).toBe("");
    expect(after.weightGsm).toBeNull();
    expect(after.sources).toEqual({ stretch: "ai-suggested" });
  });

  it("changes the name and gives the name the new source", () => {
    const after = accepted(applyAction(suggested(), change({ name: "Jersey" }))).spec.fabrics[0];
    expect(after.name).toBe("Jersey");
    expect(after.provenance).toBe("user-edited");
    expect(after.sources.composition).toBe("ai-suggested");
  });

  it("does not change the design it is given", () => {
    const before = suggested();
    const copy = JSON.stringify(before);
    accepted(applyAction(before, change({ finish: "Washed" })));
    expect(JSON.stringify(before)).toBe(copy);
  });

  it("refuses a change with nothing in it, a fabric that is not there, and a field it does not know", () => {
    expect(rejected(applyAction(suggested(), change({})))).toBe("That change is not understood.");
    expect(rejected(applyAction(suggested(), { ...change({ finish: "x" }), id: "gone" }))).toBe("There is no fabric with the id gone.");
    expect(rejected(applyAction(suggested(), change({ colour: "red" })))).toBe("That change is not understood.");
    expect(rejected(applyAction(suggested(), change({ weightGsm: 0 })))).toBe("That change is not understood.");
  });
});

describe("migrating a version 5 design", () => {
  const version5 = (fabrics: object[]): Record<string, unknown> => {
    const plain = JSON.parse(JSON.stringify(start("crew-tee"))) as Record<string, unknown>;
    return {
      ...plain,
      schemaVersion: 5,
      fabrics: fabrics.map((item) => {
        const { sources, ...rest } = item as Record<string, unknown>;
        void sources;
        return rest;
      }),
    };
  };

  it("copies the old source of a fabric onto each field that has a value", () => {
    const result = migrateSpec(version5([fabric("main", { composition: "Cotton", weightGsm: 150, provenance: "brand-supplied", consumption: "" })]));
    if (!result.ok) throw new Error(result.reason);
    expect(result.spec.schemaVersion).toBe(6);
    expect(result.spec.fabrics[0].sources).toEqual({
      composition: "brand-supplied",
      weightGsm: "brand-supplied",
      stretch: "brand-supplied",
    });
    expect(result.spec.fabrics[0].provenance).toBe("brand-supplied");
  });

  it("gives a fabric with nothing described no sources", () => {
    const empty = fabric("main", { composition: "", weightGsm: null, stretch: "not-set", provenance: "user-edited" });
    const result = migrateSpec(version5([empty]));
    if (!result.ok) throw new Error(result.reason);
    expect(result.spec.fabrics[0].sources).toEqual({});
  });

  it("adds an empty not used flag to nothing: components are left as they were", () => {
    const result = migrateSpec(version5([fabric("main")]));
    if (!result.ok) throw new Error(result.reason);
    expect(result.spec.components).toEqual([]);
  });
});
