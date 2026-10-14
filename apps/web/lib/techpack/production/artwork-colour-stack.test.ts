import { describe, expect, it } from "vitest";
import { gradedJersey } from "@/lib/print/fixtures/graded";
import { createPieceMapper } from "@/lib/print/layout/mapper";
import { buildZones } from "@/lib/print/zones/build";
import { JERSEY_ZONES } from "@/lib/print/zones/templates";
import { buildColourways } from "../colourways";
import { fullDesign } from "../fixtures/designs";
import { ALL_KINDS_STACK, ASSETS, CAMO_CREST_STACK, DOTS_STACK, GROUND_STACK, LOW_DPI_ACCEPTED, PICTURE_ACCEPTED, PICTURE_STACK, SMALL_CREST, STACK_BY_KIND } from "../fixtures/stacks";
import { buildArtworkAndColour, coloursFor } from "./artwork-colour";
import type { ProductionInput } from "./input";

const colourways = buildColourways(fullDesign("polo"));
const pattern = gradedJersey(["46", "48", "50"]);
const zones = buildZones(JERSEY_ZONES, pattern, createPieceMapper(pattern).anchors);
const built = (input: ProductionInput, technique: string | null = "sublimation") => buildArtworkAndColour({ assets: ASSETS, ...input }, colourways, technique);

describe("the artwork and colour page of a design with an artwork stack", () => {
  it("is built from the stack, with the design in plain English", () => {
    const section = built({ stack: CAMO_CREST_STACK });
    expect(section.source).toBe("stack");
    expect(section.description).toContain("Camo in");
    expect(section.description).toContain("seed 7");
    expect(section.layers.map((row) => row.id)).toEqual(["ground-body", "camo", "crest", "mark-back-name"]);
  });

  it("lists each colour with its role, screen colour and typed codes, and ships no Pantone data", () => {
    const rows = built({ stack: DOTS_STACK }).colours;
    expect(rows.map((row) => [row.id, row.role])).toEqual([["C1", "ground"], ["C2", "dots"], ["C3", "numbers"], ["C4", "camo"]]);
    expect(rows[0]).toMatchObject({ factoryCode: { value: "NV-204" }, screenColour: { value: "#1b2a49" }, otherCodes: "None typed" });
    expect(rows[1]).toMatchObject({ factoryCode: { status: "to-be-confirmed" }, otherCodes: "Pantone TCX 13-0859 TCX (as typed)" });
    expect(built({ stack: DOTS_STACK }).colourNote).toContain("Knitwright ships no Pantone data");
  });

  it("gives the colours of the colourway asked for", () => {
    expect(built({ stack: DOTS_STACK, colourwayId: "away" }).colours[0]?.screenColour).toMatchObject({ value: "#aa0000" });
  });

  it("lists every layer of every kind with its kind, place, clear space and per-size placement", () => {
    const section = built({ stack: ALL_KINDS_STACK, pattern, zones });
    expect(section.layers).toHaveLength(7);
    expect(section.layers.find((row) => row.id === "crest")).toMatchObject({ kind: "Placed picture", where: "Crest zone" });
    expect(section.layerPlacements.filter((row) => row.layerId === "crest").map((row) => row.size)).toEqual(["46", "48", "50"]);
    expect(section.layerPlacementNote).toMatch(/^Measured on the pattern/);
  });

  it("says no placement can be measured until the pattern and zones are in", () => {
    const section = built({ stack: ALL_KINDS_STACK });
    expect(section.layerPlacements).toEqual([]);
    expect(section.layerPlacementNote).toBe("Placements are measured on the pattern once it is in the library and the print files have their zones.");
  });

  it("gives the repeat spec for any design, not only dots", () => {
    expect(built({ stack: CAMO_CREST_STACK }).repeatSpecs.map((row) => [row.layerId, row.kind, row.seed])).toEqual([["camo", "generator", "Seed 7"]]);
    expect(built({ stack: ALL_KINDS_STACK }).repeatSpecs.map((row) => row.layerId)).toEqual(["dots", "club-tile"]);
    expect(built({ stack: GROUND_STACK }).repeatSpecs).toEqual([]);
  });

  it("shows the dots' sizes as the repeat block when the stack has dots and nobody gave a repeat", () => {
    const repeat = built({ stack: DOTS_STACK }).repeat!;
    expect(repeat.lengths.map((row) => [row.label, row.measure.status === "set" ? row.measure.value : ""])).toEqual([
      ["Dot size across", "3.0"], ["Pitch, centre to centre along a row", "7.0"], ["Row step", "3.5"], ["Clear space around marks", "1.0"],
    ]);
    expect(repeat.settings.find((row) => row.label === "Every other row")?.setting).toMatchObject({ value: "Dropped by half a pitch" });
    expect(repeat.ok).toBe(true);
    expect(built({ stack: CAMO_CREST_STACK }).repeat).toBeNull();
  });

  it("prefers a repeat that was given over the one worked out from the stack", () => {
    const given = { style: "dots" as const, diameterMm: 20, pitchMm: 50, rowStepMm: 25, halfDrop: false, rowColours: { A: "gold", B: "white" }, clearSpaceMm: 5 };
    expect(built({ stack: DOTS_STACK, repeat: given }).repeat?.lengths[0]?.measure).toMatchObject({ value: "2.0" });
  });

  it("carries each picture's resolution, and whoever accepted one below the minimum", () => {
    const low = built({ stack: STACK_BY_KIND.graphic, assets: [SMALL_CREST], lowDpiAcceptances: [LOW_DPI_ACCEPTED] });
    expect(low.images.find((row) => row.layerId === "crest")).toMatchObject({ status: "below", acceptedBy: { value: "Sam Lee on 11 Oct 2026" } });
    expect(low.imagesNote).toContain("150 dpi. Knitwright default, not from your print house.");
  });

  it("carries a design read from a picture, with its report and the user's acceptance", () => {
    const section = built({ stack: PICTURE_STACK, picture: PICTURE_ACCEPTED });
    expect(section.picture?.accepted).toBe(true);
    expect(section.picture?.limits.length).toBeGreaterThan(3);
    expect(built({ stack: ALL_KINDS_STACK }).picture).toBeNull();
  });

  it("measures pictures at the fabric's print scale", () => {
    const section = built({ stack: STACK_BY_KIND.graphic, assets: [SMALL_CREST] });
    expect(section.images[0]?.printedWidth).toMatchObject({ tenthsMm: 900 });
  });
});

describe("a design without a stack", () => {
  it("falls back to the older fields: the colourways, and no layers", () => {
    const section = built({});
    expect(section).toMatchObject({ source: "legacy", description: null, layers: [], repeatSpecs: [], images: [], picture: null, layerPlacements: [] });
    expect(coloursFor({}, null, colourways)).toEqual(coloursFor({}, null, colourways));
  });
  it("prefers the colours that were given, then the stack's, then the colourways'", () => {
    const given = [{ id: "C1", role: "x", name: "x", factoryCode: null, screenColour: null, avoidAcceptedBy: null }];
    expect(coloursFor({ colours: given }, ALL_KINDS_STACK, colourways)).toBe(given);
    expect(coloursFor({}, DOTS_STACK, colourways).map((colour) => colour.role)).toEqual(["ground", "dots", "numbers", "camo"]);
  });
});
