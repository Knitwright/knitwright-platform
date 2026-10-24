import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { withKitStyle } from "@/lib/kit-styles/presets";
import { applyAll } from "./candidates";
import { decideApply, findVariant, seedFor, variantsFor } from "./apply";

const jersey = () => {
  const out = withKitStyle(start("team-jersey", "men"), "hoops", { main: "#1b2a49", second: "#d4af37", third: null });
  if (!out.ok) throw new Error(out.reason);
  return out.spec;
};

describe("seeds and lists", () => {
  it("gives a design version one seed, the same on every visit, and a different one for another version", () => {
    expect(seedFor("p1", 1)).toBe(seedFor("p1", 1));
    expect(seedFor("p1", 1)).not.toBe(seedFor("p1", 2));
    expect(seedFor("p1", 1)).not.toBe(seedFor("p2", 1));
  });

  it("lists 8 to 12 variants with the same ids each time", () => {
    const a = variantsFor(jersey(), "p1", 3);
    const b = variantsFor(jersey(), "p1", 3);
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a.length).toBeLessThanOrEqual(12);
    expect(a.map((v) => v.id)).toEqual(b.map((v) => v.id));
  });

  it("finds a variant by id and says nothing for an unknown id", () => {
    const list = variantsFor(jersey(), "p1", 1);
    expect(findVariant(list, list[2].id)).toBe(list[2]);
    expect(findVariant(list, "v-00000000")).toBeUndefined();
  });
});

describe("deciding what applying does", () => {
  const base = jersey();
  const variant = variantsFor(base, "p1", 1)[0];

  it("saves when the person is looking at the current version", () => {
    expect(decideApply({ expectedVersion: 4, currentVersion: 4, variantSpec: variant.spec, currentSpec: base })).toBe("save");
  });

  it("answers 'already applied' when the next version is exactly this variant, so a double click makes one version", () => {
    expect(decideApply({ expectedVersion: 1, currentVersion: 2, variantSpec: variant.spec, currentSpec: variant.spec })).toBe("already");
  });

  it("is a conflict when the design moved on to something else", () => {
    const other = variantsFor(base, "p1", 1)[1];
    expect(decideApply({ expectedVersion: 1, currentVersion: 2, variantSpec: variant.spec, currentSpec: other.spec })).toBe("conflict");
    expect(decideApply({ expectedVersion: 1, currentVersion: 5, variantSpec: variant.spec, currentSpec: variant.spec })).toBe("conflict");
  });

  it("applying the variant's actions to the version it came from gives the variant's design", () => {
    expect(applyAll(base, variant.actions)).toEqual(variant.spec);
  });
});
