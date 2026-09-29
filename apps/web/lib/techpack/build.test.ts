import { describe, expect, it } from "vitest";
import { deepFreeze } from "@/lib/garment/fixtures/freeze";
import { start } from "@/lib/garment/fixtures/specs";
import { buildTechPack } from "./build";
import { CHARTS, TOPS_IDS, fullDesign, inputFor, packFor, revisions } from "./fixtures/designs";
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
          pack.flats,
          pack.measurements,
          pack.howToMeasure,
          pack.components,
          pack.construction,
          pack.colourways,
          pack.artwork,
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
