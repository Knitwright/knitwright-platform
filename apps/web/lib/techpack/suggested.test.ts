import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { designWith } from "@/lib/flat/fixtures/designs";
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { action, typeIds } from "@/lib/garment/fixtures/arbitraries";
import { start } from "@/lib/garment/fixtures/specs";
import { CHARTS } from "./fixtures/charts";
import { packFor } from "./fixtures/designs";
import { PROPOSAL_WORDS } from "./text";
import { SUGGESTION_SOURCES, buildSuggested } from "./suggested";
import { allCells } from "./walk";
import type { TechPack } from "./types";

const apply = (spec: GarmentSpec, act: SpecAction): GarmentSpec => {
  const result = applyAction(spec, act);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

const section = (spec: GarmentSpec, charts?: typeof CHARTS) => packFor(spec, charts ? { charts } : {}).suggested;
const labels = (spec: GarmentSpec, charts?: typeof CHARTS) =>
  section(spec, charts).items.map((item) => `${item.sectionId}: ${item.label}`);

const withoutModels = (pack: TechPack): unknown => ({
  ...pack,
  flats: { ...pack.flats, views: pack.flats.views.map((view) => ({ ...view, model: null })) },
  suggested: null,
});

/** How many cells in the document are a suggestion, and how many are a proposal by the platform. */
function countCells(pack: TechPack): { suggested: number; proposed: number } {
  const cells = allCells(withoutModels(pack)).map((entry) => entry.cell);
  return {
    suggested: cells.filter((cell) => cell.status === "set" && SUGGESTION_SOURCES.includes(cell.provenance as never)).length,
    proposed: cells.filter((cell) => cell.status === "set" && cell.proposal === true).length,
  };
}

describe("the suggested values page", () => {
  it("lists no suggestion in a design where a person typed everything, and says so", () => {
    const pack = packFor(start("crew-tee"));
    expect(pack.suggested.id).toBe("suggested");
    expect(pack.suggested.title).toBe("Suggested values");
    expect(pack.suggested.items).toEqual([]);
    expect(pack.suggested.note).toBe("Nothing in this document is a suggestion from a size chart, the assistant or a picture.");
  });

  it("lists a suggested option with where it appears", () => {
    const spec = apply(start("polo"), { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "ai-suggested" });
    expect(section(spec).items).toEqual([
      { sectionId: "cover", sectionTitle: "Cover", label: "Fit: Slim", provenance: "ai-suggested", cells: 1 },
    ]);
  });

  it("lists suggested values in every part of the document", () => {
    let spec = start("polo");
    const steps: SpecAction[] = [
      { type: "set-measurement", pointId: "chest-width", value: 5200, provenance: "ai-suggested" },
      { type: "change-fabric", id: "main", changes: { composition: "Cotton" }, provenance: "read-from-image" },
      { type: "update-colourway", colourway: { id: "main", name: "Home", colours: [{ panelId: "collar", colour: "Red", provenance: "ai-suggested" }] } },
      {
        type: "add-artwork",
        artwork: {
          id: "crest",
          name: "Crest",
          source: { kind: "text", text: "FC" },
          panelId: "body-front",
          anchor: "centre-chest",
          offsetX: 0,
          offsetY: 0,
          width: 500,
          height: 500,
          rotationDegrees: 0,
          technique: "transfer",
          provenance: "ai-suggested",
        },
      },
      { type: "set-component", component: { id: "buttons", name: "Shell", details: "", quantity: "", provenance: "ai-suggested" } },
      { type: "set-construction", entry: { seamId: "body-hem", stitchDensity: "Dense", provenance: "read-from-image" } },
      { type: "set-labelling", field: "care", text: "Wash cold", provenance: "ai-suggested" },
    ];
    for (const step of steps) spec = apply(spec, step);
    expect(labels(spec)).toEqual([
      "measurements: Chest width",
      "components: Fabric for Body front, Body back, Left sleeve, Right sleeve, Collar and Placket: composition",
      "components: Buttons: name",
      "construction: Body hem: stitch density",
      "colourways: Home: Collar: colour code",
      "artwork: Crest: name, part, place, across, down, width, height, turn, how it is made and shows",
      "labelling: Care instructions",
    ]);
  });

  it("lists the sizes and the size run when they come from a chart", () => {
    const spec = designWith("crew-tee", {});
    const found = labels(spec, CHARTS);
    expect(found).toContain("cover: Base size");
    expect(found).toContain("cover: Size run");
  });

  it("lists the values that come from a size chart, by point, with the sizes and the tolerance", () => {
    const items = section(designWith("crew-tee", {}), CHARTS).items.filter((item) => item.label.startsWith("Chest width"));
    expect(items.map((item) => item.label)).toEqual(["Chest width: value for sizes U1, U2, U3 and U4 and tolerance"]);
    expect(items[0]).toMatchObject({ provenance: "suggested-chart", sectionId: "measurements", cells: 5 });
  });

  it("names one size in the singular", () => {
    const sized = apply(designWith("crew-tee", {}), { type: "set-sizing", sizing: { sizes: ["U3"], baseSize: "U3" } });
    expect(labels(sized, CHARTS)).toContain("measurements: Chest width: value for size U3 and tolerance");
  });

  it("does not list what a person typed", () => {
    const spec = apply(start("crew-tee"), { type: "set-measurement", pointId: "chest-width", value: 5200, provenance: "user-edited" });
    expect(section(spec).items).toEqual([]);
  });

  it("says every value on the page is a suggestion when there are some", () => {
    expect(section(designWith("crew-tee", {}), CHARTS).note).toBe(
      "Every value in the first list is a suggestion. Confirm each one, or replace it with your own.",
    );
  });
});

describe("the proposals by the platform", () => {
  it("lists each seam whose classes come from the registry rule, under its own list", () => {
    const suggested = packFor(start("crew-tee")).suggested;
    expect(suggested.items).toEqual([]);
    expect(suggested.proposals.filter((item) => item.sectionId === "construction").map((item) => item.label).slice(0, 2)).toEqual([
      "Shoulder seam: seam class and stitch class",
      "Armhole seam: seam class and stitch class",
    ]);
    for (const item of suggested.proposals) {
      expect(item.sectionId === "construction" || item.sectionId === "components").toBe(true);
      expect(item.provenance).toBe("derived");
    }
  });

  it("says in its note that they are proposed and not confirmed by anyone", () => {
    expect(packFor(start("crew-tee")).suggested.proposalsNote).toBe(
      `${PROPOSAL_WORDS} These are the seam and stitch classes, and the parts, that Knitwright proposes from general knitwear practice.`,
    );
  });

  it("drops a class from the proposals once the user chose it", () => {
    const spec = apply(start("crew-tee"), {
      type: "set-construction",
      entry: { seamId: "body-hem", seamClass: "bound", stitchClass: "lockstitch", stitchDensity: "", provenance: "user-edited" },
    });
    expect(packFor(spec).suggested.proposals.map((item) => item.label)).not.toContain("Body hem: seam class and stitch class");
  });

  it("keeps a seam in the proposals while one of its two classes is still a proposal", () => {
    const spec = apply(start("crew-tee"), {
      type: "set-construction",
      entry: { seamId: "body-hem", seamClass: "bound", stitchDensity: "", provenance: "user-edited" },
    });
    expect(packFor(spec).suggested.proposals.map((item) => item.label)).toContain("Body hem: stitch class");
  });
});

describe("nothing is left off the page", () => {
  it("lists every cell of the document that is a suggestion or a proposal, for designs made by random changes", () => {
    let checked = 0;
    fc.assert(
      fc.property(fc.constantFrom(...typeIds.slice(0, -1)), fc.array(action, { maxLength: 20 }), fc.boolean(), (typeId, actions, charts) => {
        let spec: GarmentSpec = start(typeId);
        for (const next of actions) {
          const result = applyAction(spec, next);
          if (result.ok) spec = result.spec;
        }
        const pack = packFor(spec, charts ? { charts: CHARTS } : {});
        const found = countCells(pack);
        expect(pack.suggested.items.reduce((sum, item) => sum + item.cells, 0)).toBe(found.suggested);
        expect(pack.suggested.proposals.reduce((sum, item) => sum + item.cells, 0)).toBe(found.proposed);
        checked += 1;
      }),
      { numRuns: 40 },
    );
    expect(checked).toBe(40);
  });

  it("lists a size and a size run that come from a chart, which an earlier page left off", () => {
    const pack = packFor(designWith("polo", {}), { charts: CHARTS });
    expect(pack.cover.baseSize).toMatchObject({ provenance: "suggested-chart" });
    expect(pack.suggested.items.map((item) => item.label)).toEqual(expect.arrayContaining(["Base size", "Size run"]));
  });

  it("uses only sources that are suggestions", () => {
    for (const item of section(designWith("crew-tee", {}), CHARTS).items) expect(SUGGESTION_SOURCES).toContain(item.provenance);
  });
});

describe("buildSuggested", () => {
  it("is made from the finished document, so it cannot list what the document does not hold", () => {
    const pack = packFor(start("crew-tee"));
    expect(buildSuggested(pack)).toEqual(pack.suggested);
  });
});
