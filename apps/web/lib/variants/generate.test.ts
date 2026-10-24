import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { clubColoursFrom, withKitStyle } from "@/lib/kit-styles/presets";
import { deepEqual, sameDesign } from "@/lib/projects/same-design";
import { generateVariants, structureKept, type VariantGate } from "./generate";

const apply = (spec: GarmentSpec, action: SpecAction): GarmentSpec => {
  const outcome = applyAction(spec, action);
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.spec;
};

const sponsor = (anchor: string, id = "sponsor"): SpecAction => ({
  type: "add-artwork",
  artwork: {
    id,
    name: "Sponsor",
    source: { kind: "text", text: "ACME" },
    panelId: "body-front",
    anchor,
    offsetX: 0,
    offsetY: 0,
    width: 800,
    height: 300,
    rotationDegrees: 0,
    technique: "sublimation",
    provenance: "user-edited",
  },
});

const styled = (): GarmentSpec => {
  const plain = start("team-jersey", "men");
  const out = withKitStyle(plain, "hoops", { main: "#1b2a49", second: "#d4af37", third: null });
  if (!out.ok) throw new Error(out.reason);
  return apply(apply(out.spec, sponsor("left-chest")), sponsor("lower-front", "crest"));
};

describe("generateVariants", () => {
  it("is the same for the same design and seed, and differs for another seed", () => {
    const spec = styled();
    const a = generateVariants(spec, { count: 10, seed: 7 });
    const b = generateVariants(spec, { count: 10, seed: 7 });
    expect(a.map((v) => v.id)).toEqual(b.map((v) => v.id));
    expect(deepEqual(a, b)).toBe(true);
    const c = generateVariants(spec, { count: 10, seed: 8 });
    expect(c.map((v) => v.id)).not.toEqual(a.map((v) => v.id));
  });

  it.each([8, 9, 10, 11, 12])("returns %i variants when asked", (count) => {
    expect(generateVariants(styled(), { count, seed: count })).toHaveLength(count);
  });

  it("clamps the count to 8 to 12", () => {
    expect(generateVariants(styled(), { count: 2, seed: 1 })).toHaveLength(8);
    expect(generateVariants(styled(), { count: 40, seed: 1 })).toHaveLength(12);
  });

  it("holds for many seeds: in range, distinct, changed, structure kept, no blocker", () => {
    const spec = styled();
    for (let seed = 0; seed < 40; seed += 1) {
      const variants = generateVariants(spec, { count: 8 + (seed % 5), seed });
      expect(variants.length).toBeGreaterThanOrEqual(8);
      expect(variants.length).toBeLessThanOrEqual(12);
      expect(new Set(variants.map((v) => v.id)).size).toBe(variants.length);
      for (const variant of variants) {
        expect(sameDesign(variant.spec, spec)).toBe(false);
        expect(structureKept(spec, variant.spec)).toBe(true);
        expect(variant.warnings.every((w) => w.severity === "warning")).toBe(true);
      }
      for (let i = 0; i < variants.length; i += 1) {
        for (let j = i + 1; j < variants.length; j += 1) expect(sameDesign(variants[i].spec, variants[j].spec)).toBe(false);
      }
    }
  });

  it("offers colourways, kit styles and placement moves, in separate kinds", () => {
    const kinds = new Set(generateVariants(styled(), { count: 12, seed: 3 }).map((v) => v.kind));
    expect(kinds).toEqual(new Set(["colourway", "kit-style", "placement"]));
  });

  it("draws colourways from the club kit and from harmonious palettes", () => {
    const spec = styled();
    const club = clubColoursFrom(spec);
    const colourways = generateVariants(spec, { count: 12, seed: 5 }).filter((v) => v.kind === "colourway");
    expect(colourways.length).toBeGreaterThan(1);
    const mains = colourways.map((v) => clubColoursFrom(v.spec).main);
    expect(mains.some((main) => main !== club.main)).toBe(true);
    expect(colourways.some((v) => clubColoursFrom(v.spec).main === club.second)).toBe(true);
  });

  it("moves only artwork the design has, to a named zone of the same panel, keeping its size", () => {
    const spec = styled();
    const moves = generateVariants(spec, { count: 12, seed: 2 }).filter((v) => v.kind === "placement");
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      expect(move.spec.artwork).toHaveLength(2);
      move.spec.artwork.forEach((item, index) => {
        expect(item.panelId).toBe(spec.artwork[index].panelId);
        expect(["centre-chest", "left-chest", "right-chest", "lower-front"]).toContain(item.anchor);
        expect(item.width).toBe(spec.artwork[index].width);
        expect(item.offsetX).toBe(0);
      });
    }
  });

  it("drops a candidate that brings a blocker the design did not have, and tries the next", () => {
    const spec = styled();
    const banned = new Set<string>();
    const gate: VariantGate = (candidate) =>
      candidate.artwork[0]?.anchor === "centre-chest" || banned.has(candidate.kitPattern?.style ?? "plain")
        ? [{ code: "test-blocker", severity: "blocker", panel: null, message: "A test blocker." }]
        : [];
    banned.add("stripes");
    const variants = generateVariants(spec, { count: 10, seed: 4, gate });
    expect(variants).toHaveLength(10);
    for (const v of variants) {
      expect(v.spec.artwork[0].anchor).not.toBe("centre-chest");
      expect(v.spec.kitPattern?.style).not.toBe("stripes");
    }
  });

  it("ignores blockers the design already carries", () => {
    const gate: VariantGate = () => [{ code: "already", severity: "blocker", panel: null, message: "Already there." }];
    expect(generateVariants(styled(), { count: 8, seed: 1, gate })).toHaveLength(8);
  });

  it("keeps a warning on the variant that carries it", () => {
    const gate: VariantGate = (candidate) =>
      candidate.kitPattern?.style !== "hoops" ? [{ code: "note", severity: "warning", panel: null, message: "Watch this." }] : [];
    const shown = generateVariants(styled(), { count: 12, seed: 6, gate });
    const other = shown.filter((v) => v.spec.kitPattern?.style !== "hoops");
    expect(other.length).toBeGreaterThan(0);
    for (const v of other) expect(v.warnings.map((w) => w.message)).toContain("Watch this.");
    for (const v of shown.filter((x) => x.spec.kitPattern?.style === "hoops")) expect(v.warnings.map((w) => w.message)).not.toContain("Watch this.");
  });

  it("warns, never blocks, for a very saturated colour (the gamut estimate)", () => {
    const variants = generateVariants(styled(), { count: 12, seed: 9 });
    expect(variants.every((v) => v.warnings.every((w) => w.severity === "warning"))).toBe(true);
  });

  it("returns nothing for a garment with no kit styles, and does not change the design", () => {
    const tee = start("joggers", "men");
    const before = JSON.stringify(tee);
    const out = generateVariants(tee, { count: 10, seed: 1 });
    expect(JSON.stringify(tee)).toBe(before);
    expect(out.length).toBe(0);
  });
});
