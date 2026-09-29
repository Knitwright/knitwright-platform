import { describe, expect, it } from "vitest";
import { applyAction, createSpec, specActionSchema, type GarmentSpec } from "@/lib/garment";
import { deepFreeze } from "./fixtures/freeze";
import { editMeasurementAction, resetMeasurementAction } from "./edit";
import { MADE_UP_CHART_SET } from "./fixtures/made-up-charts";
import { resolveMeasurements } from "./resolve";

function crewTee(): GarmentSpec {
  const made = createSpec("crew-tee", "men");
  if (!made.ok) throw new Error(made.reason);
  return deepFreeze(made.spec);
}

describe("editMeasurementAction", () => {
  it("turns a typed value into a set-measurement owned by the person who typed it", () => {
    expect(editMeasurementAction(crewTee(), "chest-width", 5250, "user-edited")).toEqual({
      ok: true,
      action: { type: "set-measurement", pointId: "chest-width", value: 5250, provenance: "user-edited" },
    });
    expect(editMeasurementAction(crewTee(), "chest-width", 5250, "brand-supplied")).toMatchObject({
      ok: true,
      action: { provenance: "brand-supplied" },
    });
  });

  it("gives an action the spec accepts, and the value then wins over the chart", () => {
    const result = editMeasurementAction(crewTee(), "chest-width", 3333, "brand-supplied");
    if (!result.ok) throw new Error(result.reason);
    expect(specActionSchema.safeParse(result.action).success).toBe(true);
    const applied = applyAction(crewTee(), result.action);
    if (!applied.ok) throw new Error("Not applied.");
    const row = resolveMeasurements(applied.spec, "T3", MADE_UP_CHART_SET).rows.find((entry) => entry.pointId === "chest-width");
    expect(row).toMatchObject({ value: 3333, provenance: "brand-supplied" });
  });

  it("refuses a point that does not apply to the design", () => {
    const result = editMeasurementAction(crewTee(), "placket-length", 1000, "user-edited");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("does not apply");
  });

  it("refuses values that are zero, negative, fractional, too large or not finite", () => {
    for (const value of [0, -5, 12.5, 30_001, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = editMeasurementAction(crewTee(), "chest-width", value, "user-edited");
      expect(result.ok).toBe(false);
    }
  });
});

describe("resetMeasurementAction", () => {
  const edited = (): GarmentSpec => ({
    ...crewTee(),
    measurements: [{ pointId: "chest-width", value: 5000, provenance: "user-edited" }],
  });

  it("returns a remove-measurement when the value was set by a person", () => {
    expect(resetMeasurementAction(edited(), "chest-width")).toEqual({
      ok: true,
      action: { type: "remove-measurement", pointId: "chest-width" },
    });
  });

  it("says a value is already from the chart when nothing was set", () => {
    const result = resetMeasurementAction(crewTee(), "chest-width");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("already");
  });
});
