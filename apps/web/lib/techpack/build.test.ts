import { describe, expect, it } from "vitest";
import type { GarmentSpec } from "@/lib/garment";
import { deepFreeze } from "@/lib/garment/fixtures/freeze";
import { start } from "@/lib/garment/fixtures/specs";
import { buildTechPack } from "./build";
import { CHARTS, TOPS_IDS, fullDesign, inputFor, packFor, revisions } from "./fixtures/designs";
import { completeProduction, targetedJersey } from "./fixtures/production";
import { SECTION_IDS, SECTION_TITLES } from "./types";

describe("buildTechPack", () => {
  it("has every section, in reading order, for every tops type, both empty and full", () => {
    for (const typeId of TOPS_IDS) {
      for (const spec of [start(typeId), fullDesign(typeId)]) {
        const pack = packFor(spec);
        expect(pack.sections.map((section) => section.id)).toEqual([...SECTION_IDS]);
        expect(pack.sections.map((section) => section.title)).toEqual(SECTION_IDS.map((id) => SECTION_TITLES[id]));
        const own = [
          pack.cover,
          pack.readiness,
          pack.flats,
          pack.measurements,
          pack.howToMeasure,
          pack.patternAndCutting,
          pack.components,
          pack.fabric,
          pack.construction,
          pack.colourways,
          pack.artwork,
          pack.artworkAndColour,
          pack.operations,
          pack.labelling,
          pack.suggested,
          pack.signOff,
        ];
        expect(own.map((section) => section.id)).toEqual([...SECTION_IDS]);
        for (const section of own) expect(section.title).toBe(SECTION_TITLES[section.id]);
      }
    }
  });

  it("gives each section's note in the list of sections, so a contents page can show it", () => {
    const pack = packFor(start("crew-tee"));
    expect(pack.sections.find((section) => section.id === "measurements")?.note).toBe(pack.measurements.note);
  });

  it("carries the title and the date to print as they were passed in", () => {
    const pack = buildTechPack(inputFor(start("crew-tee"), { printedOn: "1 Jan 2030", printedOnIso: "2030-01-01" }));
    expect(pack.title).toBe("Tech pack");
    expect(pack.printedOn).toBe("1 Jan 2030");
    expect(pack.printedOnIso).toBe("2030-01-01");
  });

  it("has a cover with the version and the date it was passed", () => {
    const pack = buildTechPack(inputFor(start("crew-tee"), { version: 7, versionDate: "2 Feb 2030", history: revisions(2) }));
    expect(pack.cover.version).toBe(7);
    expect(pack.cover.date).toBe("2 Feb 2030");
    expect(pack.cover.revisions).toHaveLength(2);
  });

  it("does not change its input and answers the same twice", () => {
    const input = deepFreeze(inputFor(fullDesign("polo"), { history: revisions(3), charts: CHARTS }));
    const first = buildTechPack(input);
    expect(buildTechPack(input)).toEqual(first);
  });

  it("depends on the design and nothing else: two calls with equal input give equal documents", () => {
    const a = packFor(fullDesign("team-jersey"));
    const b = packFor(fullDesign("team-jersey"));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("has the sign-off empty in every document", () => {
    for (const typeId of TOPS_IDS) {
      expect(packFor(fullDesign(typeId)).signOff).toEqual(packFor(start(typeId)).signOff);
    }
  });
});

describe("buildTechPack with the production records", () => {
  const production = () => completeProduction();
  const jersey = () => targetedJersey();

  it("builds every v2 section from the records, and the same twice from frozen input", () => {
    const input = deepFreeze(inputFor(jersey(), { production: production() }));
    const first = buildTechPack(input);
    expect(buildTechPack(input)).toEqual(first);
    expect(first.patternAndCutting.cutList).toHaveLength(4);
    expect(first.fabric.printScaleLength).toMatchObject({ value: "1.0204" });
    expect(first.artworkAndColour.colours.map((colour) => colour.id)).toEqual(["C1", "C2", "C3", "C4"]);
    expect(first.artworkAndColour.placements).toHaveLength(2);
    expect(first.operations.steps[0]?.stage).toBe("print");
    expect(first.signOff.lines.find((line) => line.role === "Pattern")?.name).toMatchObject({ value: "Ana Reyes" });
    expect(first.measurements.onPattern?.outside).toBe(0);
  });

  it("builds the same v2 sections, empty and saying what is missing, with no records at all", () => {
    const pack = buildTechPack(inputFor(jersey()));
    expect(pack.patternAndCutting.note).toBe("No pattern yet. A technician's draft or your own DXF file is needed.");
    expect(pack.measurements.onPattern).toBeNull();
    expect(pack.readiness.ready).toBe(false);
    expect(pack.readiness.groups.flatMap((group) => group.items).filter((item) => !item.met).length).toBeGreaterThan(10);
  });

  it("does not make the list say ready for a design whose components are still proposals", () => {
    const pack = buildTechPack(inputFor(jersey(), { production: production() }));
    const open = pack.readiness.groups.flatMap((group) => group.items).filter((item) => !item.met).map((item) => item.id);
    expect(open).toContain("components-no-proposals");
    expect(open).not.toContain("pattern-present");
  });

  it("takes the decoration method from the design when the records give none", () => {
    const pack = buildTechPack(inputFor(jersey(), { production: { ...production(), technique: null } }));
    expect(pack.operations.technique).toEqual({ status: "to-be-confirmed" });
    const kit: GarmentSpec = { ...jersey(), kitPattern: { style: "stripes", colours: [{ colour: "red" }], technique: "transfer", provenance: "user-edited" } };
    expect(buildTechPack(inputFor(kit)).operations.technique).toMatchObject({ value: "transfer" });
  });
});
