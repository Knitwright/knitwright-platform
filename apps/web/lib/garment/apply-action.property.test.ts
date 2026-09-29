import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { panelsFor } from "./applicability";
import { applyAction } from "./apply-action";
import { fabricFor } from "./fabric";
import { deepFreeze } from "./fixtures/freeze";
import { PROVENANCE_VALUES } from "./provenance";
import { WEARERS } from "./primitives";
import { listTypes } from "./registry";
import { TOPS } from "./registry/tops";
import { createSpec, validateSpec, type GarmentSpec } from "./spec";

const FILE_ID = "3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11";
const typeIds = [...listTypes("tops").map((type) => type.id), "kilt"];
const optionIds = [...TOPS.options.map((option) => option.id), "bogus-option"];
const choiceIds = [...new Set(TOPS.options.flatMap((option) => option.choices.map((c) => c.id))), "nope"];
const pointIds = [...TOPS.pointsOfMeasure.map((point) => point.id), "inseam"];
const panelIds = TOPS.panels.map((panel) => panel.id);
const anchorIds = [...new Set(TOPS.panels.flatMap((panel) => panel.anchors.map((a) => a.id)))];
const smallIds = ["main", "away", "logo", "crest"];

const provenance = fc.constantFrom(...PROVENANCE_VALUES);

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

const action = fc.oneof(
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
  { weight: 1, arbitrary: fc.record({ type: fc.constant("change-wearer"), wearer: fc.constantFrom(...WEARERS, "kids") }) },
  { weight: 3, arbitrary: fc.record({ type: fc.constant("change-type"), typeId: fc.constantFrom(...typeIds) }) },
);

type Accepted = Extract<ReturnType<typeof applyAction>, { ok: true }>;

/** Every panel whose fabric changed without being asked for must appear in the report. */
function expectFabricChangesReported(before: GarmentSpec, result: Accepted, action: { type?: unknown }): void {
  if (action.type === "assign-fabric") return;
  const kept = new Set(panelsFor(before).map((panel) => panel.id));
  const reported = new Set(result.dropped.map((item) => item.id));
  for (const panel of panelsFor(result.spec).filter((entry) => kept.has(entry.id))) {
    if (fabricFor(before, panel.id).id !== fabricFor(result.spec, panel.id).id) {
      expect(reported.has(panel.id)).toBe(true);
    }
  }
}

function start(typeId: string): GarmentSpec {
  const result = createSpec(typeId, "men");
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
}

describe("applyAction on any sequence of changes", () => {
  it("never returns an invalid design, never changes its input, and gives the same answer twice", () => {
    let accepted = 0;
    let rejected = 0;
    fc.assert(
      fc.property(
        fc.constantFrom(...typeIds.slice(0, -1)),
        fc.array(action, { maxLength: 30 }),
        (typeId, actions) => {
          let spec = deepFreeze(start(typeId));
          for (const next of actions) {
            const snapshot = JSON.stringify(spec);
            const result = applyAction(spec, next);
            expect(JSON.stringify(spec)).toBe(snapshot);
            expect(applyAction(spec, next)).toEqual(result);
            if (result.ok) {
              accepted += 1;
              expect(validateSpec(result.spec).ok).toBe(true);
              expectFabricChangesReported(spec, result, next);
              spec = deepFreeze(result.spec);
            } else {
              rejected += 1;
              expect(result.reason.length).toBeGreaterThan(0);
            }
          }
        },
      ),
      { numRuns: 300 },
    );
    expect(accepted).toBeGreaterThan(200);
    expect(rejected).toBeGreaterThan(200);
  });
});
