import { describe, expect, it } from "vitest";
import type { GarmentSpec, NamesAndNumbers } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { PLAYER_MARKS_NOTE } from "./artwork";
import { exportSections } from "./exports/tables";
import { fullDesign, packFor } from "./fixtures/designs";
import { buildSuggested } from "./suggested";
import { allCells } from "./walk";

const marks = (patch: Partial<NamesAndNumbers> = {}): NamesAndNumbers => ({
  places: [{ place: "back-name" }, { place: "back-number", height: 2500 }],
  style: "block",
  colour: "Gold 123C",
  sampleName: "PLAYER",
  sampleNumber: "10",
  technique: "sublimation",
  provenance: "user-edited",
  ...patch,
});

const withMarks = (spec: GarmentSpec, value: NamesAndNumbers): GarmentSpec => ({ ...spec, namesAndNumbers: value });

describe("player names and numbers in the tech pack", () => {
  it("gives one line for each place, with what was chosen, and a height only when typed", () => {
    const { artwork } = packFor(withMarks(start("team-jersey"), marks()));
    expect(artwork.note).toBeNull();
    expect(artwork.playerMarksNote).toBe(PLAYER_MARKS_NOTE);
    const [name, number] = artwork.playerMarks;
    expect(name.place).toMatchObject({ value: "Name across the upper back" });
    expect(name.shows).toMatchObject({ value: "Name, sample PLAYER" });
    expect(name.height).toEqual({ status: "to-be-confirmed" });
    expect(number.height).toMatchObject({ status: "set", tenthsMm: 2500 });
    expect(number.style).toMatchObject({ value: "Block" });
    expect(number.colour).toMatchObject({ value: "Gold 123C" });
    expect(number.screenColour).toEqual({ status: "to-be-confirmed" });
    expect(number.technique).toMatchObject({ value: "Sublimation" });
  });

  it("leaves style and how it is made to be confirmed when nobody chose them", () => {
    const { artwork } = packFor(withMarks(start("team-jersey"), marks({ style: undefined, technique: undefined, colour: "" })));
    const [line] = artwork.playerMarks;
    expect([line.style, line.technique, line.colour]).toEqual([
      { status: "to-be-confirmed" },
      { status: "to-be-confirmed" },
      { status: "to-be-confirmed" },
    ]);
  });

  it("has no lines and no note for a design without them", () => {
    const { artwork } = packFor(start("team-jersey"));
    expect(artwork.playerMarks).toEqual([]);
    expect(artwork.playerMarksNote).toBeNull();
  });

  it("puts every cell in the export tables exactly once, as a table of its own", () => {
    const pack = packFor(withMarks(fullDesign("team-jersey"), marks()));
    const sections = exportSections(pack);
    const artwork = sections.find((section) => section.id === "artwork")!;
    const table = artwork.tables.find((entry) => entry.title === "Player names and numbers");
    expect(table?.rows).toHaveLength(2);
    expect(artwork.paragraphs).toContain(PLAYER_MARKS_NOTE);
    const inTables = sections.flatMap((section) =>
      section.tables.flatMap((entry) => entry.rows.flatMap((row) => row.flatMap((datum) => ("cell" in datum && datum.cell ? [datum.cell] : [])))),
    );
    expect(inTables.length).toBe(allCells(pack).length);
    expect(JSON.stringify(table)).not.toContain('"tenthsMm":600');
  });

  it("names a suggested value by its place on the suggested values page", () => {
    const pack = packFor(withMarks(start("team-jersey"), marks({ provenance: "ai-suggested" })));
    const labels = buildSuggested(pack).items.map((item) => item.label);
    expect(labels.some((label) => label.startsWith("Name across the upper back"))).toBe(true);
  });
});
