import { describe, expect, it } from "vitest";
import { createPieceMapper } from "@/lib/print/layout/mapper";
import { buildZones } from "@/lib/print/zones/build";
import { JERSEY_ZONES } from "@/lib/print/zones/templates";
import { gradedJersey } from "@/lib/print/fixtures/graded";
import { ALL_KINDS_STACK, GROUND_STACK } from "../fixtures/stacks";
import { layerPlacementRows, PLACEMENT_NOTE } from "./layer-placement";

const pattern = gradedJersey(["46", "48", "50"]);
const zones = buildZones(JERSEY_ZONES, pattern, createPieceMapper(pattern).anchors);
const cmOf = (cell: { status: string; tenthsMm?: number }) => (cell.status === "set" ? (cell.tenthsMm ?? 0) / 100 : NaN);

describe("where each placed layer sits on every size", () => {
  const rows = layerPlacementRows(ALL_KINDS_STACK, { pattern, zones });
  const of = (layerId: string) => rows.filter((row) => row.layerId === layerId);

  it("measures a row for every placed layer, view and size, through the print files' mapper", () => {
    expect(rows.map((row) => `${row.layerId}:${row.size}`)).toEqual(
      ["crest", "sleeve-logo", "sponsor", "mark-back-name"].flatMap((id) => ["46", "48", "50"].map((size) => `${id}:${size}`)),
    );
    for (const row of rows) {
      expect(row.down.status, `${row.layerId} ${row.size}`).toBe("set");
      expect(row.across.status).toBe("set");
    }
  });

  it("measures from the high point of shoulder and the centre line, with the piece named", () => {
    const [first] = of("crest");
    expect(first).toMatchObject({ layer: "Club crest", view: "front", pieceName: "torso front" });
    expect(cmOf(first!.across)).toBeCloseTo(11, 0);
    expect(of("mark-back-name")[0]).toMatchObject({ view: "back", pieceName: "torso back" });
  });

  it("keeps a mark the same distance from the centre in every size and moves it down with the length of the body", () => {
    const across = of("crest").map((row) => cmOf(row.across));
    expect(Math.max(...across) - Math.min(...across)).toBeLessThan(0.1);
    const down = of("crest").map((row) => cmOf(row.down));
    expect(down[0]).toBeLessThan(down[1]!);
    expect(down[1]).toBeLessThan(down[2]!);
  });

  it("adds the offset of the layer to the middle of its place", () => {
    const sponsor = of("sponsor").map((row) => cmOf(row.down));
    const logo = of("sleeve-logo").map((row) => cmOf(row.down));
    expect(sponsor[1]! - logo[1]!).toBeCloseTo(2, 0);
  });

  it("gives nothing for a stack with no placed layer", () => {
    expect(layerPlacementRows(GROUND_STACK, { pattern, zones })).toEqual([]);
  });

  it("leaves a row to be confirmed when the place is not one this garment has, or the pattern is missing", () => {
    const lost = layerPlacementRows(ALL_KINDS_STACK, { pattern, zones: [] }).filter((row) => row.layerId === "crest");
    expect(lost.map((row) => row.down.status)).toEqual(["to-be-confirmed", "to-be-confirmed", "to-be-confirmed"]);
    expect(layerPlacementRows(ALL_KINDS_STACK, { pattern: null, zones })).toEqual([]);
  });

  it("explains how the places were measured, or why they were not", () => {
    expect(PLACEMENT_NOTE).toMatch(/^Measured on the pattern/);
  });
});
