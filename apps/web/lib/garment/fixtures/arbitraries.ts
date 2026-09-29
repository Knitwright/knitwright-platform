import fc from "fast-check";
import { listSeamClasses, listStitchClasses } from "../construction";
import { PROVENANCE_VALUES } from "../provenance";
import { WEARERS } from "../primitives";
import { listTypes } from "../registry";
import { TOPS } from "../registry/tops";

/**
 * Test support. Random values for every kind of change a design accepts, some of them
 * deliberately wrong, so property tests can build designs by applying changes one after another.
 */
const FILE_ID = "3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11";
export const typeIds = [...listTypes("tops").map((type) => type.id), "kilt"];
const optionIds = [...TOPS.options.map((option) => option.id), "bogus-option"];
const choiceIds = [...new Set(TOPS.options.flatMap((option) => option.choices.map((c) => c.id))), "nope"];
const pointIds = [...TOPS.pointsOfMeasure.map((point) => point.id), "inseam"];
const panelIds = TOPS.panels.map((panel) => panel.id);
const anchorIds = [...new Set(TOPS.panels.flatMap((panel) => panel.anchors.map((a) => a.id)))];
const smallIds = ["main", "away", "logo", "crest"];

const provenance = fc.constantFrom(...PROVENANCE_VALUES);
const slotIds = [...TOPS.components.map((slot) => slot.id), "mystery"];
const seamIds = [...TOPS.seams.map((seam) => seam.id), "mystery"];
const classIds = [
  ...listStitchClasses().map((entry) => entry.id),
  ...listSeamClasses().map((entry) => entry.id),
  "glued",
];

const component = fc.record({
  id: fc.constantFrom(...slotIds),
  name: fc.constantFrom("", "Thread", "Shell buttons"),
  details: fc.constantFrom("", "Matched to the main colour"),
  quantity: fc.constantFrom("", "2 cones", "12 pieces"),
  provenance,
});

const constructionEntry = fc.record({
  seamId: fc.constantFrom(...seamIds),
  seamClass: fc.option(fc.constantFrom(...classIds), { nil: undefined }),
  stitchClass: fc.option(fc.constantFrom(...classIds), { nil: undefined }),
  stitchDensity: fc.constantFrom("", "12 per inch"),
  provenance,
});

const colourway = fc.record({
  id: fc.constantFrom(...smallIds),
  name: fc.constantFrom("Home", "Away", " Third "),
  colours: fc.uniqueArray(
    fc.record({ panelId: fc.constantFrom(...panelIds), colour: fc.constantFrom("navy", "red"), provenance: provenance }),
    { selector: (entry) => entry.panelId, maxLength: 4 },
  ),
});

const fabricIds = ["main", "mesh", "rib"];
const fabric = fc.record({
  id: fc.constantFrom(...fabricIds),
  name: fc.constantFrom("Main fabric", "Mesh"),
  composition: fc.constantFrom("", "polyester"),
  construction: fc.constant(""),
  weightGsm: fc.option(fc.integer({ min: 1, max: 400 }), { nil: null }),
  finish: fc.constant(""),
  consumption: fc.constantFrom("", "1.4 m per garment"),
  stretch: fc.constantFrom("none", "two-way", "not-set"),
  provenance: fc.constantFrom(...PROVENANCE_VALUES),
});

const artwork = fc.record({
  id: fc.constantFrom(...smallIds),
  name: fc.constantFrom("Crest", "Logo"),
  provenance,
  rotationDegrees: fc.integer({ min: 0, max: 359 }),
  source: fc.constant({ kind: "file", fileId: FILE_ID }),
  panelId: fc.constantFrom(...panelIds),
  anchor: fc.constantFrom(...anchorIds),
  offsetX: fc.integer({ min: -500, max: 500 }),
  offsetY: fc.integer({ min: -500, max: 500 }),
  width: fc.integer({ min: 1, max: 2000 }),
  height: fc.integer({ min: 1, max: 2000 }),
  technique: fc.constantFrom("sublimation", "transfer", "screen-print", "embroidery"),
});

export const action = fc.oneof(
  { weight: 6, arbitrary: fc.record({ type: fc.constant("set-option"), optionId: fc.constantFrom(...optionIds), choiceId: fc.constantFrom(...choiceIds), provenance }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant("set-sizing"), sizing: fc.constantFrom(null, { sizes: ["S", "M", "L"], baseSize: "M" }, { sizes: ["S"], baseSize: "L" }) }) },
  { weight: 5, arbitrary: fc.record({ type: fc.constant("set-measurement"), pointId: fc.constantFrom(...pointIds), value: fc.integer({ min: 0, max: 31_000 }), provenance: fc.constantFrom(...PROVENANCE_VALUES) }) },
  { weight: 2, arbitrary: fc.record({ type: fc.constant("remove-measurement"), pointId: fc.constantFrom(...pointIds) }) },
  { weight: 2, arbitrary: fc.record({ type: fc.constantFrom("add-fabric", "update-fabric"), fabric }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant("remove-fabric"), id: fc.constantFrom(...fabricIds) }) },
  { weight: 3, arbitrary: fc.record({ type: fc.constant("assign-fabric"), panelId: fc.constantFrom(...panelIds), fabricId: fc.constantFrom(...fabricIds) }) },
  { weight: 2, arbitrary: fc.record({ type: fc.constantFrom("add-colourway", "update-colourway"), colourway }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant("remove-colourway"), id: fc.constantFrom(...smallIds) }) },
  { weight: 2, arbitrary: fc.record({ type: fc.constantFrom("add-artwork", "update-artwork"), artwork }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant("remove-artwork"), id: fc.constantFrom(...smallIds) }) },
  { weight: 3, arbitrary: fc.record({ type: fc.constant("set-component"), component }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant("remove-component"), id: fc.constantFrom(...slotIds) }) },
  { weight: 3, arbitrary: fc.record({ type: fc.constant("set-construction"), entry: constructionEntry }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant("remove-construction"), seamId: fc.constantFrom(...seamIds) }) },
  {
    weight: 2,
    arbitrary: fc.record({
      type: fc.constant("set-labelling"),
      field: fc.constantFrom("care", "composition", "origin", "fold", "bag", "price"),
      text: fc.constantFrom("", "Wash cold", "Made in Portugal"),
      provenance,
    }),
  },
  { weight: 1, arbitrary: fc.record({ type: fc.constant("change-wearer"), wearer: fc.constantFrom(...WEARERS, "kids") }) },
  { weight: 3, arbitrary: fc.record({ type: fc.constant("change-type"), typeId: fc.constantFrom(...typeIds) }) },
);

