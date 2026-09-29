import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { panelsFor } from "./applicability";
import { applyAction } from "./apply-action";
import { fabricFor } from "./fabric";
import { action, typeIds } from "./fixtures/arbitraries";
import { deepFreeze } from "./fixtures/freeze";
import { createSpec, validateSpec, type GarmentSpec } from "./spec";

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
