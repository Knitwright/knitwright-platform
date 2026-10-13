import { describe, expect, it } from "vitest";
import { isOffered } from "@/lib/config/launch-garments";
import { createSpec, listFamilies, listTypes, pointsOfMeasureFor, type GarmentSpec, type Wearer } from "@/lib/garment";
import { chartCompleteness } from "./completeness";
import { MADE_UP_CHARTS, MADE_UP_CHART_SET } from "./fixtures/made-up-charts";
import { resolveAllSizes } from "./resolve-all";
import { resolveMeasurements } from "./resolve";

/**
 * The acceptance check of each family's model step: every type resolves at every size of
 * every chart that applies to it. The check runs twice: on made-up charts, and on the
 * default charts (the Knitwright starter charts), where a size the chart does not have
 * must stay "to be supplied" and nothing may be made up.
 */
const specFor = (typeId: string, wearer: Wearer): GarmentSpec => {
  const made = createSpec(typeId, wearer);
  if (!made.ok) throw new Error(made.reason);
  return made.spec;
};

const families = listFamilies().filter((family) => listTypes(family.id).length > 0);

describe.each(families.map((family) => [family.id] as const))("sizing for the %s family", (familyId) => {
  it("has a made-up chart for every type and every wearer it is made for", () => {
    for (const type of listTypes(familyId)) {
      for (const wearer of type.wearers) {
        expect(MADE_UP_CHARTS.some((chart) => chart.garmentType === type.id && chart.wearer === wearer), `${type.id} ${wearer}`).toBe(true);
      }
    }
  });

  it("resolves every point of every type at every size of every chart that applies", () => {
    let resolved = 0;
    for (const chart of MADE_UP_CHARTS.filter((entry) => listTypes(familyId).some((type) => type.id === entry.garmentType))) {
      const spec = specFor(chart.garmentType, chart.wearer);
      const run = MADE_UP_CHART_SET.runs.find((candidate) => candidate.id === chart.sizeRunId);
      expect(run, chart.sizeRunId).toBeDefined();
      for (const size of run?.sizes ?? []) {
        const result = resolveMeasurements(spec, size, MADE_UP_CHART_SET);
        expect(result.status, `${chart.garmentType} ${size}`).toBe("resolved");
        expect(result.rows.map((row) => row.pointId)).toEqual(pointsOfMeasureFor(spec).map((point) => point.id));
        expect(result.rows.every((row) => row.status === "set" && row.provenance === "suggested-chart" && row.value > 0)).toBe(true);
        resolved += 1;
      }
    }
    expect(resolved).toBeGreaterThan(0);
  });

  it("makes up nothing with the default charts: a size the starter chart does not have is left to be supplied", () => {
    for (const type of listTypes(familyId)) {
      for (const wearer of type.wearers) {
        const spec = { ...specFor(type.id, wearer), sizing: { sizes: ["A", "B"], baseSize: "A" } };
        const all = resolveAllSizes(spec);
        const expected = isOffered(type.id) ? "resolved" : "no-chart";
        expect(all.entries.map((entry) => entry.resolution.status)).toEqual([expected, expected]);
        for (const entry of all.entries) {
          expect(entry.resolution.rows.every((row) => row.status === "missing")).toBe(true);
          expect(entry.resolution.rows).toHaveLength(pointsOfMeasureFor(spec).length);
        }
      }
    }
  });

  it("has a starter chart for every garment offered at launch, and none yet for the others", () => {
    const entries = chartCompleteness().entries.filter((entry) => listTypes(familyId).some((type) => type.id === entry.typeId));
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) expect(entry.hasChart, `${entry.typeId} for ${entry.wearer}`).toBe(isOffered(entry.typeId));
  });
});
