import { describe, expect, it } from "vitest";
import type { GarmentSpec } from "@/lib/garment/spec-schema";
import { start } from "@/lib/garment/fixtures/specs";
import { changedFields, compareVersions, describeChanged, groupOf, STRUCTURAL_FIELDS, SURFACE_FIELDS } from "./surface";

const base = start("crew-tee");
const withField = (spec: GarmentSpec, patch: Record<string, unknown>): GarmentSpec => ({ ...spec, ...patch }) as GarmentSpec;

describe("the fields of a design", () => {
  it("names every field a real design holds, so none is unclassified by accident", () => {
    const known = new Set([...SURFACE_FIELDS, ...STRUCTURAL_FIELDS]);
    expect(Object.keys(base).filter((field) => !known.has(field))).toEqual([]);
  });

  it("puts a field nobody has classified with the structural ones", () => {
    expect(groupOf("somethingNew")).toBe("structural");
  });

  it("does not put a field in both lists", () => {
    expect(SURFACE_FIELDS.filter((field) => STRUCTURAL_FIELDS.includes(field))).toEqual([]);
  });
});

describe("comparing two versions", () => {
  it("sees no difference between a design and itself, whatever the order of its keys", () => {
    const reordered = Object.fromEntries([...Object.entries(base)].reverse()) as GarmentSpec;
    expect(compareVersions(base, reordered)).toEqual({ status: "same", changed: [] });
  });

  it("calls a new colourway or new artwork surface only", () => {
    const repainted = withField(base, { colourways: [{ ...base.colourways[0], name: "Away" }] });
    const verdict = compareVersions(base, repainted);
    expect(verdict.status).toBe("surface-only");
    expect(verdict.changed).toEqual([{ field: "colourways", group: "surface" }]);
  });

  it("calls a new fabric, size run, option or base article parameter structural", () => {
    for (const patch of [
      { fabrics: [{ ...base.fabrics[0], name: "Another cloth" }] },
      { sizing: { ...(base.sizing ?? {}), run: ["S", "M"] } },
      { options: { ...base.options, collar: { choiceId: "c03", provenance: "user-edited" } } },
      { article: { baseArticleCode: "JSY-SS-01", productionClass: "A", parameters: { body_length_mm: 700 } } },
    ]) {
      expect(compareVersions(base, withField(base, patch)).status).toBe("structural");
    }
  });

  it("calls a change that is partly structural structural", () => {
    const both = withField(base, { colourways: [{ ...base.colourways[0], name: "Away" }], typeId: "v-neck-tee" });
    const verdict = compareVersions(base, both);
    expect(verdict.status).toBe("structural");
    expect(verdict.changed.map((one) => one.field)).toEqual(["colourways", "typeId"]);
  });

  it("lists a field one version holds and the other does not", () => {
    const withExtra = withField(base, { kitPattern: { style: "hoops", colours: [] } });
    expect(changedFields(base, withExtra)).toEqual([{ field: "kitPattern", group: "surface" }]);
  });

  it("describes the changed fields in words", () => {
    expect(describeChanged([])).toBe("nothing");
    expect(describeChanged([{ field: "artwork", group: "surface" }])).toBe("artwork");
    expect(describeChanged([
      { field: "artwork", group: "surface" },
      { field: "colourways", group: "surface" },
      { field: "typeId", group: "structural" },
    ])).toBe("artwork, colourways and typeId");
  });
});
