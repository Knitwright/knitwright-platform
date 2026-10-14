import { describe, expect, it } from "vitest";
import { parseArtworkStack } from "@/lib/artwork-stack";
import { printScale } from "@/lib/production/contract";
import {
  ALL_KINDS_STACK, ASSETS, CAMO_STACK, DOTS_STACK, GRAPHIC_STACK, GROUND_STACK, MARK_STACK, PANEL_STACK, SMALL_CREST, STACK_BY_KIND, TEXT_STACK, TILE_STACK, withStack,
} from "../fixtures/stacks";
import { targetedJersey, TESTED_FABRIC } from "../fixtures/production";
import { coloursOfStack } from "./stack-colours";
import { layerRows } from "./stack-layers";
import { repeatSpecRows } from "./repeat-spec";
import { stackOf } from "./stack-source";

describe("the stack fixtures", () => {
  it("are valid artwork stacks, one for each layer kind", () => {
    for (const [kind, stack] of Object.entries(STACK_BY_KIND)) {
      expect(parseArtworkStack(stack).ok, kind).toBe(true);
      expect(stack.layers.some((layer) => layer.kind === kind), kind).toBe(true);
    }
    for (const stack of [ALL_KINDS_STACK, CAMO_STACK, PANEL_STACK]) expect(parseArtworkStack(stack).ok).toBe(true);
  });
});

describe("which artwork a design is built from", () => {
  const spec = targetedJersey();
  it("uses the stack in the production input first, then the design's own", () => {
    expect(stackOf(spec, { stack: DOTS_STACK })).toBe(DOTS_STACK);
    expect(stackOf(withStack(TEXT_STACK, spec), {})?.layers).toEqual(TEXT_STACK.layers);
    expect(stackOf(withStack(TEXT_STACK, spec), { stack: DOTS_STACK })).toBe(DOTS_STACK);
  });
  it("falls back to the older fields only when the design has no stack", () => {
    expect(stackOf(spec, {})).toBeNull();
    expect(stackOf(spec, { stack: null })).toBeNull();
  });
  it("reads a stack stored beside older fields that an older editor changed afterwards as the older fields say", () => {
    const stale = { ...withStack(GROUND_STACK, spec), kitPattern: { style: "hoops" as const, colours: [{ colour: "Gold", swatch: "#d4af37" }], provenance: "user-edited" as const } };
    const found = stackOf(stale, {});
    expect(found?.layers.some((layer) => layer.kind === "pattern")).toBe(true);
  });
});

describe("the colour list from a stack", () => {
  it("gives every colour its role, screen colour and typed codes, Pantone only as typed", () => {
    const colours = coloursOfStack(DOTS_STACK, undefined);
    expect(colours.map((colour) => colour.id)).toEqual(["C1", "C2", "C3", "C4"]);
    expect(colours[0]).toMatchObject({ role: "ground", name: "Navy", factoryCode: "NV-204", screenColour: "#1b2a49" });
    expect(colours[1]).toMatchObject({ role: "dots", factoryCode: null, typedCodes: [{ system: "Pantone TCX", value: "13-0859 TCX" }] });
    expect(colours[2]).toMatchObject({ role: "numbers", factoryCode: null, typedCodes: [] });
  });
  it("shows the colours of the colourway chosen", () => {
    const away = coloursOfStack(DOTS_STACK, "away");
    expect(away[0]).toMatchObject({ screenColour: "#aa0000", factoryCode: null });
    expect(coloursOfStack(DOTS_STACK, "nobody")[0]?.screenColour).toBe("#1b2a49");
  });
});

describe("every layer of a stack", () => {
  const rows = layerRows(ALL_KINDS_STACK, { technique: "sublimation" });
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));

  it("is listed with its kind, where it goes, clear space, technique and source", () => {
    expect(rows.map((row) => row.id)).toEqual(["ground-body", "dots", "club-tile", "crest", "sleeve-logo", "sponsor", "mark-back-name"]);
    expect(byId["ground-body"]).toMatchObject({ kind: "Ground colour", views: "front and back", clearSpace: null });
    expect(byId.dots).toMatchObject({ kind: "Pattern", where: "The whole of the front and back" });
    expect(byId["club-tile"]).toMatchObject({ kind: "Repeating picture", where: "The whole of the front and back" });
    expect(byId.crest).toMatchObject({ kind: "Placed picture", views: "front", where: "Crest zone", technique: "Sublimation" });
    expect(byId.crest?.clearSpace).toMatchObject({ status: "set", value: "1.0", tenthsMm: 100 });
    expect(byId["sleeve-logo"]).toMatchObject({ where: "Centre chest, a free anchor and not a standard zone", technique: "Sublimation" });
    expect(byId["sleeve-logo"]?.clearSpace).toMatchObject({ tenthsMm: 0 });
    expect(byId.sponsor).toMatchObject({ kind: "Text", provenance: "Typed in by you" });
    expect(byId["mark-back-name"]).toMatchObject({ kind: "Player name or number", where: "Name across the upper back" });
  });
  it("names the technique of the layer, else the design's, else says none was named", () => {
    expect(byId.dots?.technique).toBe("Sublimation");
    expect(layerRows(DOTS_STACK, {}).find((row) => row.id === "dots")?.technique).toBe("Not named");
    expect(layerRows(GRAPHIC_STACK, {}).find((row) => row.id === "crest")?.technique).toBe("Sublimation");
  });
  it("describes a pattern with its generator, colours and settings", () => {
    expect(byId.dots?.detail).toBe(
      "Polka dots in Pantone TCX 13-0859 TCX and screen colour #ffffff: Clear space around marks 10 mm, Dot width 30 mm, Every other row shifted yes, Centre to centre 70 mm, Row to row 35 mm.",
    );
    expect(layerRows(CAMO_STACK, {}).find((row) => row.id === "camo")?.detail).toContain("seed 7");
  });
  it("describes a picture fill by its mode, and the others by what they show", () => {
    expect(byId["club-tile"]?.detail).toBe("A repeating picture, every other row dropped by half a repeat.");
    expect(layerRows(PANEL_STACK, {}).find((row) => row.id === "front-art")?.detail).toBe("A picture covering the whole panel.");
    expect(byId.sponsor?.detail).toBe('The text "ACME PLUMBING", 3.0 cm tall, block lettering.');
    expect(byId.crest?.detail).toBe("Picture width 9.0 cm.");
    expect(byId["mark-back-name"]?.detail).toBe("Sample RIVERA 9. Each player's own name and number come from the team order. Height 6.0 cm.");
    expect(byId["ground-body"]?.detail).toBe("Navy, factory code NV-204.");
  });
});

describe("the repeat spec of a design", () => {
  it("gives a generator's name, settings and seed as a record a machine can read", () => {
    const [row] = repeatSpecRows(CAMO_STACK, ASSETS);
    expect(row).toMatchObject({ layerId: "camo", kind: "generator", name: "Camo", seed: "Seed 7" });
    expect(row?.repeat).toBe("Continuous across the whole design. It has no tile.");
    const parsed = JSON.parse(row?.machine ?? "");
    expect(parsed).toMatchObject({ kind: "generator", generatorId: "camo", seed: 7, repeat: "field", tileMm: null, colourIds: ["green", "gold", "white"] });
    expect(parsed.params).toEqual({ roughness: 0.3, scale: 60, spread: 0.6 });
  });
  it("gives the dots' tile and its size", () => {
    const [row] = repeatSpecRows(DOTS_STACK, ASSETS);
    expect(row?.name).toBe("Polka dots");
    expect(row?.seed).toBe("No seed");
    expect(JSON.parse(row?.machine ?? "")).toMatchObject({ generatorId: "kit-dots", params: { dotWidthMm: 30, halfDrop: true, pitchMm: 70, rowStepMm: 35 } });
  });
  it("gives a repeating picture as the tile and its repeat size", () => {
    const [row] = repeatSpecRows(TILE_STACK, ASSETS);
    expect(row).toMatchObject({ layerId: "club-tile", kind: "tile", name: "Club tile" });
    expect(row?.repeat).toBe("Repeats every 101.6 mm across and 101.6 mm down, every other row dropped by half a repeat.");
    expect(JSON.parse(row?.machine ?? "")).toEqual({
      assetId: "tile-1", halfDrop: true, kind: "tile", layerId: "club-tile", offsetMm: { x: 0, y: 0 }, rotationDeg: 0, scale: 1, tileMm: { height: 101.6, width: 101.6 },
    });
  });
  it("says the size of a repeating picture is not known without the picture", () => {
    const [row] = repeatSpecRows(TILE_STACK, []);
    expect(row?.repeat).toBe("The size of the picture is not known, so the size of the repeat is not known. Every other row dropped by half a repeat.");
    expect(JSON.parse(row?.machine ?? "").tileMm).toBeNull();
  });
  it("assumes 72 dpi, and says so, for a picture that states none", () => {
    const [row] = repeatSpecRows(TILE_STACK, [{ ...ASSETS[1]!, dpiMeta: null }]);
    expect(row?.repeat).toMatch(/^Repeats every 211\.7 mm across and 211\.7 mm down/);
    expect(row?.repeat).toContain("The picture states no resolution, so 72 dpi was assumed.");
  });
  it("has none for a stack with no pattern or tile, and none for a panel picture", () => {
    expect(repeatSpecRows(GROUND_STACK, ASSETS)).toEqual([]);
    expect(repeatSpecRows(PANEL_STACK, ASSETS)).toEqual([]);
    expect(repeatSpecRows(MARK_STACK, ASSETS)).toEqual([]);
  });
  it("names a pattern whose generator is not known by its id and gives its settings as they are", () => {
    const odd = { ...DOTS_STACK, layers: DOTS_STACK.layers.map((layer) => (layer.kind === "pattern" ? { ...layer, generatorId: "mystery" } : layer)) };
    const [row] = repeatSpecRows(odd, ASSETS);
    expect(row).toMatchObject({ name: "mystery", repeat: "This pattern is not one Knitwright knows, so its repeat is not known." });
    expect(JSON.parse(row?.machine ?? "").tileMm).toBeNull();
  });
});

describe("the scale that images are measured at", () => {
  it("is the fabric's print scale, else 1", () => {
    expect(printScale(TESTED_FABRIC).width).toBeGreaterThan(1);
    expect(SMALL_CREST.widthPx).toBe(400);
  });
});
