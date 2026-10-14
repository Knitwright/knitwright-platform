import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { fabricSummary, labellingSummary, trimSummary } from "./summaries";

const apply = (spec: GarmentSpec, action: SpecAction): GarmentSpec => {
  const result = applyAction(spec, action);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

describe("the fabric panel of the workspace", () => {
  it("lists each fabric with the parts that use it, and leaves what nobody described to be confirmed", () => {
    const [line] = fabricSummary(start("crew-tee"));
    expect(line).toEqual({
      id: "main",
      title: "Main fabric",
      parts: "Body front, Body back, Left sleeve, Right sleeve, Neckband",
      facts: [
        { label: "Composition", value: "To be confirmed" },
        { label: "Weight", value: "To be confirmed" },
        { label: "Finish", value: "To be confirmed" },
      ],
    });
  });

  it("shows what the brand typed in", () => {
    const spec = apply(start("crew-tee"), {
      type: "update-fabric",
      fabric: { ...start("crew-tee").fabrics[0], name: "Interlock", composition: "Cotton", weightGsm: 180, provenance: "brand-supplied", sources: {} },
    } as SpecAction);
    const [line] = fabricSummary(spec);
    expect(line?.title).toBe("Interlock");
    expect(line?.facts.slice(0, 2)).toEqual([
      { label: "Composition", value: "Cotton" },
      { label: "Weight", value: "180 gsm" },
    ]);
  });
});

describe("the trims of the fabric panel", () => {
  it("lists thread, labels, rib and trims by name, with what is to be confirmed", () => {
    const rows = trimSummary(start("crew-tee"));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.label.length).toBeGreaterThan(0);
      expect(row.value.length).toBeGreaterThan(0);
    }
    expect(rows.some((row) => row.value === "To be confirmed")).toBe(true);
  });
});

describe("the labelling panel of the workspace", () => {
  it("lists care, composition, origin, fold and bag, each to be confirmed until written", () => {
    const rows = labellingSummary(start("crew-tee"));
    expect(rows.map((row) => row.value)).toEqual(Array(5).fill("To be confirmed"));
    expect(rows).toHaveLength(5);
  });
});
