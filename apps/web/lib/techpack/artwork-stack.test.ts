import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import type { GarmentSpec } from "@/lib/garment";
import { buildArtwork } from "./artwork";
import { ALL_KINDS_STACK, CAMO_STACK, DOTS_STACK, GROUND_STACK, PANEL_STACK, TILE_STACK } from "./fixtures/stacks";

const hooped = (): GarmentSpec => ({
  ...start("team-jersey"),
  kitPattern: { style: "hoops", colours: [{ colour: "Gold", swatch: "#d4af37" }], provenance: "user-edited" },
});

describe("the artwork placement section of a design with a stack", () => {
  const spec = start("team-jersey");
  const section = buildArtwork(spec, ALL_KINDS_STACK);
  const item = (id: string) => section.items.find((entry) => entry.id === id)!;

  it("lists every layer that is not a ground colour or a player mark, from the stack", () => {
    expect(section.items.map((entry) => entry.id)).toEqual(["dots", "club-tile", "crest", "sleeve-logo", "sponsor"]);
    expect(section.note).toBeNull();
  });

  it("describes a pattern and a repeating picture over the whole panel, with their size left to the repeat spec", () => {
    expect(item("dots")).toMatchObject({ anchor: { value: "Whole panel" }, name: { value: "Polka dots" } });
    expect(item("dots").width).toMatchObject({ status: "set", tenthsMm: 300 });
    expect(item("dots").content).toMatchObject({ kind: "text" });
    expect(item("club-tile")).toMatchObject({ anchor: { value: "Repeating picture" }, width: { status: "to-be-confirmed" } });
  });

  it("places a picture by its zone or anchor with its offset and size in the units of the document", () => {
    expect(item("crest")).toMatchObject({ anchor: { value: "Crest zone" }, panel: { value: "front" }, technique: { value: "Sublimation" } });
    expect(item("crest").width).toMatchObject({ tenthsMm: 900 });
    expect(item("crest").height).toEqual({ status: "to-be-confirmed" });
    expect(item("crest").content).toMatchObject({ kind: "text" });
    expect(item("sleeve-logo")).toMatchObject({ across: { tenthsMm: 50 }, down: { tenthsMm: 0 }, height: { tenthsMm: 300 } });
    expect(item("sleeve-logo").content).toMatchObject({ kind: "file", fileId: "6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f" });
  });

  it("gives text its words and the height it is printed at", () => {
    expect(item("sponsor").content).toMatchObject({ kind: "text", text: { value: "ACME PLUMBING" } });
    expect(item("sponsor").height).toMatchObject({ tenthsMm: 300 });
    expect(item("sponsor").down).toMatchObject({ tenthsMm: 200 });
  });

  it("lists player marks from the stack, with the sample and the colour", () => {
    expect(section.playerMarks).toHaveLength(1);
    expect(section.playerMarks[0]).toMatchObject({
      id: "back-name",
      place: { value: "Name across the upper back" },
      shows: { value: "Name, sample RIVERA" },
      height: { tenthsMm: 600 },
      style: { value: "Block" },
      colour: { value: "White" },
      screenColour: { value: "#ffffff" },
    });
    expect(section.playerMarksNote).toContain("Each player's own name and number come from the team order");
  });

  it("says a design with only a ground has no artwork", () => {
    const plain = buildArtwork(spec, GROUND_STACK);
    expect(plain.items).toEqual([]);
    expect(plain.note).toBe("No artwork has been added to this design.");
    expect(plain.playerMarksNote).toBeNull();
  });

  it("measures a panel picture and a camo by what they are", () => {
    expect(buildArtwork(spec, PANEL_STACK).items[0]).toMatchObject({ anchor: { value: "Whole panel" }, panel: { value: "front" } });
    expect(buildArtwork(spec, CAMO_STACK).items[0]?.name).toMatchObject({ value: "Camo" });
    expect(buildArtwork(spec, TILE_STACK).items[0]?.technique).toEqual({ status: "to-be-confirmed" });
  });
});

describe("the older fields", () => {
  it("are used only when the design has no stack", () => {
    const spec = hooped();
    expect(buildArtwork(spec).items.map((entry) => entry.id)).toEqual(["kit-pattern"]);
    expect(buildArtwork(spec, null).items.map((entry) => entry.id)).toEqual(["kit-pattern"]);
    expect(buildArtwork(spec, DOTS_STACK).items.map((entry) => entry.id)).toEqual(["dots"]);
  });
});
