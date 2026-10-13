import { describe, expect, it } from "vitest";
import { designWith, madeUpForType } from "@/lib/flat/fixtures/designs";
import type { FlatModel } from "@/lib/flat/model";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { measurementTable } from "@/lib/projects/measurement-table";
import { CHARTS, packFor } from "./fixtures/designs";
import type { MeasureRow, TechPack } from "./types";

/**
 * Plan step 8, task 10, and acceptance criterion M3: change one measurement, and the flat, the
 * table and the document all change, all from the one new version.
 */

const before = (): GarmentSpec => designWith("crew-tee", {}, madeUpForType("crew-tee", {}));

const after = (spec: GarmentSpec, value: number): GarmentSpec => {
  const result = applyAction(spec, { type: "set-measurement", pointId: "chest-width", value, provenance: "user-edited" });
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

const chestRow = (pack: TechPack): MeasureRow => {
  const row = pack.measurements.groups.flatMap((group) => group.rows).find((entry) => entry.pointId === "chest-width");
  if (!row) throw new Error("No chest row");
  return row;
};

const panelsOf = (model: FlatModel | null): string =>
  JSON.stringify((model?.layers ?? []).find((layer) => layer.id === "panels")?.elements ?? []);

const calloutsOf = (model: FlatModel | null): string[] =>
  (model?.layers ?? [])
    .filter((layer) => layer.id === "measurements")
    .flatMap((layer) => layer.elements)
    .flatMap((element) => (element.kind === "text" ? [element.text] : []));

describe("three-way test: one measurement changes the flat, the table and the document", () => {
  const oldSpec = before();
  const newSpec = after(oldSpec, 5600);
  const oldPack = packFor(oldSpec);
  const newPack = packFor(newSpec);

  it("changes the geometry of the flat", () => {
    expect(panelsOf(newPack.flats.views[0]?.model ?? null)).not.toBe(panelsOf(oldPack.flats.views[0]?.model ?? null));
    expect(panelsOf(newPack.flats.views[1]?.model ?? null)).not.toBe(panelsOf(oldPack.flats.views[1]?.model ?? null));
  });

  it("changes the callout line on the flat, which still carries the code of its row in the table", () => {
    const lineOf = (pack: TechPack) =>
      JSON.stringify(
        (pack.flats.views[0]?.model?.layers ?? [])
          .flatMap((layer) => layer.elements)
          .find((element) => element.kind === "path" && element.name === "A line"),
      );
    expect(calloutsOf(oldPack.flats.views[0]?.model ?? null)).toContain("A");
    expect(calloutsOf(newPack.flats.views[0]?.model ?? null)).toContain("A");
    expect(lineOf(newPack)).not.toBe(lineOf(oldPack));
    expect(chestRow(newPack).code).toBe("A");
  });

  it("changes the row of the table, and no other row", () => {
    expect(chestRow(oldPack).values[0]).toMatchObject({ value: "52.0", tenthsMm: 5200 });
    expect(chestRow(newPack).values[0]).toMatchObject({ value: "56.0", tenthsMm: 5600, provenance: "user-edited" });
    const others = (pack: TechPack) =>
      pack.measurements.groups.flatMap((group) => group.rows).filter((row) => row.pointId !== "chest-width");
    expect(others(newPack)).toEqual(others(oldPack));
  });

  it("changes the document, and only what depends on the measurement", () => {
    expect(JSON.stringify(newPack)).not.toBe(JSON.stringify(oldPack));
    expect(newPack.cover).toEqual(oldPack.cover);
    expect(newPack.components).toEqual(oldPack.components);
    expect(newPack.construction).toEqual(oldPack.construction);
    expect(newPack.howToMeasure).toEqual(oldPack.howToMeasure);
  });

  it("agrees with the editor table for the same version", () => {
    const editor = measurementTable(newSpec).groups.flatMap((group) => group.rows).find((row) => row.pointId === "chest-width");
    expect(editor?.valueTenths).toBe(5600);
    expect(chestRow(newPack).values[0]).toMatchObject({ value: "56.0", tenthsMm: editor?.valueTenths });
  });

  it("agrees with the table for every point of measure when a size chart supplies the sizes", () => {
    const spec = after(designWith("crew-tee", {}), 5600);
    const pack = packFor(spec, { charts: CHARTS });
    const editor = measurementTable(spec, CHARTS);
    for (const row of editor.groups.flatMap((group) => group.rows)) {
      const cell = pack.measurements.groups.flatMap((group) => group.rows).find((entry) => entry.pointId === row.pointId);
      const baseIndex = pack.measurements.columns.findIndex((column) => column.isBase);
      expect(cell?.values[baseIndex], row.pointId).toMatchObject({ tenthsMm: row.valueTenths });
    }
  });

  it("keeps the drawing and the table in step when the value goes back", () => {
    const back = packFor(after(newSpec, 5200));
    expect(JSON.stringify(back)).toBe(JSON.stringify(oldPack));
  });
});
