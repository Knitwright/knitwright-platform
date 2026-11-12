import { describe, expect, it } from "vitest";
import type { GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { clubColoursFrom, withKitStyle } from "@/lib/kit-styles/presets";
import { structureKept } from "@/lib/variants/generate";
import type { VariantGate } from "@/lib/variants/types";
import { ERAS, eraColour, eraLead, isEra, patternFamiliesFor, recolourKit, retroRemix, validVariants } from "./remix";

const jersey = (): GarmentSpec => {
  const out = withKitStyle(start("team-jersey", "men"), "hoops", { main: "#1b2a49", second: "#d4af37", third: null });
  if (!out.ok) throw new Error(out.reason);
  return out.spec;
};

describe("retroRemix", () => {
  it("makes four validated variants in the chosen pattern family for every era", () => {
    for (const era of ERAS) {
      const variants = retroRemix(jersey(), { era, family: "stripes" });
      expect(variants).toHaveLength(4);
      for (const variant of variants) {
        expect(variant.spec.kitPattern?.style).toBe("stripes");
        expect(structureKept(jersey(), variant.spec)).toBe(true);
        expect(variant.id).toMatch(/^v-[0-9a-f]{8}$/);
      }
    }
  });

  it("is deterministic: the same design and answers give the same variants", () => {
    const a = retroRemix(jersey(), { era: "80s", family: "sash" });
    const b = retroRemix(jersey(), { era: "80s", family: "sash" });
    expect(a.map((one) => one.id)).toEqual(b.map((one) => one.id));
  });

  it("changes only colours and the kit pattern: never artwork, never a picture", () => {
    for (const variant of retroRemix(jersey(), { era: "70s", family: "plain" })) {
      for (const action of variant.actions) expect(["update-colourway", "set-kit-pattern", "remove-kit-pattern"]).toContain(action.type);
      expect(variant.spec.artwork).toEqual(jersey().artwork);
    }
  });

  it("offers nothing for a family the garment does not come in", () => {
    expect(retroRemix(jersey(), { era: "90s", family: "zigzag" })).toEqual([]);
    expect(patternFamiliesFor("team-jersey").map((one) => one.id)).toContain("hoops");
    expect(patternFamiliesFor("no-such-garment")).toEqual([]);
  });

  it("drops a candidate that brings a new blocker", () => {
    const gate: VariantGate = (spec) =>
      clubColoursFrom(spec).main === clubColoursFrom(jersey()).main ? [] : [{ code: "X", severity: "blocker", panel: null, message: "no" }];
    expect(retroRemix(jersey(), { era: "00s", family: "hoops" }, gate)).toEqual([]);
  });
});

describe("recolourKit", () => {
  it("keeps the kit pattern and puts the new main colour on the body", () => {
    const variants = recolourKit(jersey(), { main: "#b22222", second: null });
    expect(variants.length).toBeGreaterThan(0);
    expect(variants[0]?.spec.kitPattern?.style).toBe("hoops");
    expect(clubColoursFrom(variants[0]!.spec).main).toBe("#b22222");
  });

  it("returns nothing for a garment with no kit styles", () => {
    expect(recolourKit(start("joggers", "men"), { main: "#b22222", second: "#ffffff" })).toEqual([]);
  });
});

describe("the era helpers", () => {
  it("moves a colour and stays a hex colour", () => {
    for (const era of ERAS) expect(eraColour("#1b2a49", era)).toMatch(/^#[0-9a-f]{6}$/);
    expect(eraColour("#1b2a49", "70s")).not.toBe(eraColour("#1b2a49", "80s"));
    expect(eraLead("80s")).toContain("Saturated");
    expect(isEra("90s")).toBe(true);
    expect(isEra("60s")).toBe(false);
  });

  it("stops at the number asked for", () => {
    expect(validVariants(jersey(), [], undefined, 2)).toEqual([]);
  });
});
