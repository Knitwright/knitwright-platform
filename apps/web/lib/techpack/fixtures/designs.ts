/**
 * Test support. Designs for the tech pack tests, and made-up sizes and measurements. The
 * numbers are invented so a document has something to show. They are not measurements of any
 * garment and must never be loaded as real data.
 */
import { applyAction, componentSlotsFor, listTypes, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { designWith, madeUpForType } from "@/lib/flat/fixtures/designs";
import { flatsForTechPack } from "../flats";
import { buildTechPack } from "../build";
import type { TechPackInput } from "../input";
import type { TechPack } from "../types";

export const TOPS_IDS = listTypes("tops").map((type) => type.id);

export const PROJECT = { name: "Club shirt", styleNumber: "", season: "", brandName: "Test Brand" } as const;

export const inputFor = (spec: GarmentSpec, extra: Partial<TechPackInput> = {}): TechPackInput => {
  const charts = extra.charts;
  return {
    project: PROJECT,
    version: 1,
    versionDate: "29 Sep 2026",
    versionDateIso: "2026-09-29",
    printedOn: "30 Sep 2026",
    printedOnIso: "2026-09-30",
    history: [],
    spec,
    flats: flatsForTechPack(spec, charts),
    ...extra,
  };
};

export const packFor = (spec: GarmentSpec, extra: Partial<TechPackInput> = {}): TechPack =>
  buildTechPack(inputFor(spec, extra));

export { revisions } from "./revisions";

const apply = (spec: GarmentSpec, action: SpecAction): GarmentSpec => {
  const result = applyAction(spec, action);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

/** A design with every kind of thing the tech pack can hold filled in by a person. */
export function fullDesign(typeId: string): GarmentSpec {
  const first = designWith(typeId, {}, madeUpForType(typeId, {}));
  const actions: SpecAction[] = [
    { type: "set-sizing", sizing: { sizes: ["S", "M", "L"], baseSize: "M" } },
    {
      type: "update-fabric",
      fabric: {
        id: "main",
        name: "Interlock",
        composition: "Cotton and elastane",
        construction: "Interlock knit",
        weightGsm: 180,
        finish: "Enzyme washed",
        consumption: "1.2 m",
        stretch: "two-way",
        provenance: "user-edited", sources: {}
      },
    },
    { type: "add-colourway", colourway: { id: "away", name: "Away", colours: [{ panelId: "body-front", colour: "White", provenance: "user-edited" }] } },
    {
      type: "update-colourway",
      colourway: {
        id: "main",
        name: "Home",
        colours: [
          { panelId: "body-front", colour: "Navy 19-4052", swatch: "#1b2a49", provenance: "user-edited" },
          { panelId: "body-back", colour: "", swatch: "#aa0000", provenance: "user-edited" },
        ],
      },
    },
    {
      type: "add-artwork",
      artwork: {
        id: "crest",
        name: "Club crest",
        source: { kind: "text", text: "FC" },
        panelId: "body-front",
        anchor: "left-chest",
        offsetX: 100,
        offsetY: -50,
        width: 800,
        height: 400,
        rotationDegrees: 10,
        technique: "embroidery",
        provenance: "user-edited",
      },
    },
    { type: "set-construction", entry: { seamId: "body-hem", stitchDensity: "Dense", provenance: "user-edited" } },
    ...(["care", "composition", "origin", "fold", "bag"] as const).map(
      (field): SpecAction => ({ type: "set-labelling", field, text: `Text for ${field}`, provenance: "user-edited" }),
    ),
  ];
  const withActions = actions.reduce(apply, first);
  return componentSlotsFor(withActions).reduce(
    (spec, slot) =>
      apply(spec, {
        type: "set-component",
        component: { id: slot.id, name: `Name of ${slot.label}`, details: "Some details", quantity: "2 pieces", provenance: "user-edited" },
      }),
    withActions,
  );
}

export { CHARTS } from "./charts";
