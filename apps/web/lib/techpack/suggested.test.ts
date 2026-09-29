import { describe, expect, it } from "vitest";
import { designWith } from "@/lib/flat/fixtures/designs";
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { CHARTS } from "./fixtures/charts";
import { buildSuggested } from "./suggested";

const apply = (spec: GarmentSpec, action: SpecAction): GarmentSpec => {
  const result = applyAction(spec, action);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

const labels = (spec: GarmentSpec, charts = undefined as typeof CHARTS | undefined) =>
  buildSuggested(spec, charts).items.map((item) => `${item.sectionId}: ${item.label}`);

describe("the suggested values page", () => {
  it("says so when there are none", () => {
    const section = buildSuggested(start("crew-tee"));
    expect(section.id).toBe("suggested");
    expect(section.title).toBe("Suggested values");
    expect(section.items).toEqual([]);
    expect(section.note).toBe("Nothing in this document is a suggestion from a size chart, the assistant or a picture.");
  });

  it("does not list what a person typed, or what was worked out from the registry", () => {
    const spec = apply(start("crew-tee"), { type: "set-measurement", pointId: "chest-width", value: 5200, provenance: "user-edited" });
    expect(buildSuggested(spec).items).toEqual([]);
  });

  it("lists a suggested option with where it appears", () => {
    const spec = apply(start("polo"), { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "ai-suggested" });
    const [item] = buildSuggested(spec).items;
    expect(item).toEqual({
      sectionId: "cover",
      sectionTitle: "Cover",
      label: "Fit: Slim",
      provenance: "ai-suggested",
    });
  });

  it("lists a suggested measurement, fabric, colour, artwork, component, stitch detail and label", () => {
    let spec = start("polo");
    const steps: SpecAction[] = [
      { type: "set-measurement", pointId: "chest-width", value: 5200, provenance: "ai-suggested" },
      { type: "update-fabric", fabric: { ...spec.fabrics[0], composition: "Cotton", provenance: "read-from-image" } },
      { type: "update-colourway", colourway: { id: "main", name: "Home", colours: [{ panelId: "collar", colour: "Red", provenance: "ai-suggested" }] } },
      {
        type: "add-artwork",
        artwork: {
          id: "crest",
          name: "Crest",
          source: { kind: "text", text: "FC" },
          panelId: "body-front",
          anchor: "centre-chest",
          offsetX: 0,
          offsetY: 0,
          width: 500,
          height: 500,
          rotationDegrees: 0,
          technique: "transfer",
          provenance: "ai-suggested",
        },
      },
      { type: "set-component", component: { id: "buttons", name: "Shell", details: "", quantity: "", provenance: "ai-suggested" } },
      { type: "set-construction", entry: { seamId: "body-hem", stitchDensity: "Dense", provenance: "read-from-image" } },
      { type: "set-labelling", field: "care", text: "Wash cold", provenance: "ai-suggested" },
    ];
    for (const step of steps) spec = apply(spec, step);
    expect(labels(spec)).toEqual([
      "measurements: Chest width",
      "components: Main fabric",
      "colourways: Home: Collar",
      "artwork: Crest",
      "components: Buttons",
      "construction: Body hem",
      "labelling: Care instructions",
    ]);
  });

  it("lists the values that come from a size chart, by point, with the sizes and the tolerance", () => {
    const spec = designWith("crew-tee", {});
    const items = buildSuggested(spec, CHARTS).items;
    const chest = items.filter((item) => item.label.startsWith("Chest width"));
    expect(chest.map((item) => item.label)).toEqual([
      "Chest width: value for sizes U1, U2, U3 and U4",
      "Chest width: tolerance",
    ]);
    expect(chest.every((item) => item.provenance === "suggested-chart" && item.sectionId === "measurements")).toBe(true);
    expect(buildSuggested(spec, CHARTS).note).toBe(
      "Every value on this page is a suggestion. Confirm each one, or replace it with your own.",
    );
  });

  it("names one size in the singular", () => {
    const sized = apply(designWith("crew-tee", {}), { type: "set-sizing", sizing: { sizes: ["U3"], baseSize: "U3" } });
    expect(labels(sized, CHARTS)).toContain("measurements: Chest width: value for size U3");
  });

  it("lists a suggested value once, even when it appears in the table and in the design", () => {
    const spec = apply(start("crew-tee"), { type: "set-measurement", pointId: "chest-width", value: 5200, provenance: "suggested-chart" });
    const chest = buildSuggested(spec).items.filter((item) => item.label.startsWith("Chest width"));
    expect(chest).toHaveLength(1);
  });

  it("lists only sources that are suggestions", () => {
    const spec = designWith("crew-tee", {});
    for (const item of buildSuggested(spec, CHARTS).items) {
      expect(["suggested-chart", "ai-suggested", "read-from-image"]).toContain(item.provenance);
    }
  });
});
