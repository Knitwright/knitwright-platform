import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PROVENANCE_VALUES, applyAction, listTypes, type GarmentSpec } from "@/lib/garment";
import { action, typeIds } from "@/lib/garment/fixtures/arbitraries";
import { start } from "@/lib/garment/fixtures/specs";
import { CHARTS, TOPS_IDS, fullDesign, packFor, revisions } from "./fixtures/designs";
import { withoutDrawings } from "./flats";
import type { TechPack } from "./types";
import { allCells, leaves } from "./walk";

/** The drawings hold geometry, not values a factory reads. Everything else is walked. */
const MODELS = /^(flats\.views\[\d+\]|colourways\.colourways\[\d+\]\.drawing)\.model/;

/** Paths of text and numbers that are not values: names of things, ids, codes, notes and sentences. */
const NOT_VALUES: readonly RegExp[] = [
  /^(title|printedOn|printedOnIso)$/,
  /^sections\[\d+\]\.(id|title|note)$/,
  /^[a-zA-Z]+\.(id|title|note)$/,
  /^cover\.(version|date|dateIso|olderRevisionsNote)$/,
  /^cover\.options\[\d+\]\.(id|label)$/,
  /^cover\.revisions\[\d+\]\.(version|date|dateIso|note|by)$/,
  /^flats\.views\[\d+\]\.(view|label|notice|description)$/,
  /^flats\.callouts\[\d+\]\.(code|pointId|label)$/,
  /^measurements\.(sizesFrom)$/,
  /^measurements\.columns\[\d+\]\.(size|label)$/,
  /^measurements\.groups\[\d+\]\.(group|label)$/,
  /^measurements\.groups\[\d+\]\.rows\[\d+\]\.(pointId|code|label)$/,
  /^measurements\.groups\[\d+\]\.rows\[\d+\]\.notes\[\d+\]$/,
  /^howToMeasure\.rows\[\d+\]\.(pointId|code|label|howToMeasure)$/,
  /^components\.fabrics\[\d+\]\.fabricId$/,
  /^components\.fabrics\[\d+\]\.panels\[\d+\]\.(id|label)$/,
  /^components\.others\[\d+\]\.(slotId|label|kind|kindLabel|help|note|notUsed)$/,
  /^components\.others\[\d+\]\.panels\[\d+\]\.(id|label)$/,
  /^construction\.seams\[\d+\]\.(seamId|label|caveat)$/,
  /^construction\.seams\[\d+\]\.panels\[\d+\]\.(id|label)$/,
  /^colourways\.colourways\[\d+\]\.(id|name)$/,
  /^colourways\.colourways\[\d+\]\.drawing\.(view|label|notice|description)$/,
  /^colourways\.colourways\[\d+\]\.rows\[\d+\]\.(panelId|label)$/,
  /^artwork\.items\[\d+\]\.(id)$/,
  /^artwork\.items\[\d+\]\.content\.(kind|fileId)$/,
  /^labelling\.rows\[\d+\]\.(field|label)$/,
  /^suggested\.(items|proposals)\[\d+\]\.(sectionId|sectionTitle|label|provenance|cells)$/,
  /^suggested\.proposalsNote$/,
  /^signOff\.statement$/,
];

const withoutModels = (pack: TechPack): unknown => withoutDrawings(pack);

/** True when the path is a cell or sits inside one. It looks up each shorter path in a set. */
function insideACell(path: string, cellPaths: ReadonlySet<string>): boolean {
  for (let end = path.length; end > 0; end = Math.max(path.lastIndexOf(".", end - 1), path.lastIndexOf("[", end - 1))) {
    if (cellPaths.has(path.slice(0, end))) return true;
  }
  return false;
}

/** Checks the rules that make it impossible to hold a value without its source. */
function expectEveryValueHasASource(pack: TechPack): void {
  const document = withoutModels(pack);
  const cells = allCells(document);
  expect(cells.length).toBeGreaterThan(20);
  for (const { path, cell } of cells) {
    if (cell.status === "set") {
      expect(typeof cell.value, path).toBe("string");
      expect((cell.value as string).length, path).toBeGreaterThan(0);
      expect(PROVENANCE_VALUES, path).toContain(cell.provenance);
    } else {
      expect(cell.status, path).toBe("to-be-confirmed");
      expect(Object.keys(cell), path).toEqual(["status"]);
    }
  }
  const cellPaths = new Set(cells.map((entry) => entry.path));
  // Every string and number is inside a cell, or is on the list of things that are not values.
  for (const { path } of leaves(document, MODELS)) {
    const inCell = insideACell(path, cellPaths);
    if (!inCell) expect(NOT_VALUES.some((allowed) => allowed.test(path)), `${path} is a value outside a cell`).toBe(true);
  }
  // No object outside a cell carries a source, so a source is never held without its value.
  expect(JSON.stringify(document).match(/"provenance"/g)?.length ?? 0).toBe(
    cells.filter((entry) => entry.cell.status === "set").length + pack.suggested.items.length + pack.suggested.proposals.length,
  );
}

describe("every value has a source (invariant I5)", () => {
  it("holds for every tops type, empty and full, with and without a size chart", () => {
    for (const typeId of TOPS_IDS) {
      expectEveryValueHasASource(packFor(start(typeId)));
      expectEveryValueHasASource(packFor(fullDesign(typeId), { history: revisions(3) }));
      expectEveryValueHasASource(packFor(fullDesign(typeId), { charts: CHARTS }));
    }
  });

  it("holds for every type of every other family, empty and sized, with and without a size chart", () => {
    const others = listTypes().filter((type) => type.family !== "tops");
    expect(others.length).toBeGreaterThan(0);
    for (const { id } of others) {
      const sized = { ...start(id), sizing: { sizes: ["S", "M", "L"], baseSize: "M" } };
      expectEveryValueHasASource(packFor(start(id)));
      expectEveryValueHasASource(packFor(sized));
      expectEveryValueHasASource(packFor(start(id), { charts: CHARTS }));
    }
  });

  it("holds for documents built from designs made by random changes", () => {
    let built = 0;
    fc.assert(
      fc.property(fc.constantFrom(...typeIds.slice(0, -1)), fc.array(action, { maxLength: 25 }), fc.boolean(), (typeId, actions, withCharts) => {
        let spec: GarmentSpec = start(typeId);
        for (const next of actions) {
          const result = applyAction(spec, next);
          if (result.ok) spec = result.spec;
        }
        expectEveryValueHasASource(packFor(spec, withCharts ? { charts: CHARTS } : {}));
        built += 1;
      }),
      { numRuns: 60 },
    );
    expect(built).toBe(60);
  });

  it("fails when a value is held without its source", () => {
    const pack = packFor(start("crew-tee"));
    const broken = { ...pack, cover: { ...pack.cover, styleNumber: { status: "set", value: "CP-7" } } } as unknown as TechPack;
    expect(() => expectEveryValueHasASource(broken)).toThrow();
  });

  it("fails when a plain value sits outside a cell", () => {
    const pack = packFor(start("crew-tee"));
    const broken = { ...pack, cover: { ...pack.cover, quantity: "12 pieces" } } as unknown as TechPack;
    expect(() => expectEveryValueHasASource(broken)).toThrow();
  });
});

const DIGIT = /\d/;

const DIGITS_ALLOWED: readonly RegExp[] = [
  /^printedOn(Iso)?$/,
  /^cover\.(version|date|dateIso)$/,
  // A history note is the change log: it repeats what the user typed, such as a length.
  /^cover\.revisions\[\d+\]\.(version|date|dateIso|note)$/,
  /\.iso$/,
  // How many cells an item on the suggested page stands for.
  /^suggested\.(items|proposals)\[\d+\]\.cells$/,
];

const SHOULD_BE_TBC: readonly RegExp[] = [
  /^cover\.(styleNumber|season|baseSize|sizeRun)$/,
  /^measurements\.groups\[\d+\]\.rows\[\d+\]\.(tolerance|values\[\d+\])$/,
  /^components\.fabrics\[\d+\]\.(composition|construction|weight|finish|stretch|consumption)$/,
  /^components\.others\[\d+\]\.(name|details|quantity)$/,
  /^construction\.seams\[\d+\]\.stitchDensity$/,
  /^colourways\.colourways\[\d+\]\.rows\[\d+\]\.(code|screenColour)$/,
  /^labelling\.rows\[\d+\]\.value$/,
  /^signOff\.(name|date)$/,
];

describe("nothing is invented", () => {
  it("leaves every quantity, consumption, density, measurement and label to be confirmed in a new design", () => {
    for (const typeId of TOPS_IDS) {
      const document = withoutModels(packFor(start(typeId)));
      const cells = allCells(document);
      const expected = cells.filter((entry) => SHOULD_BE_TBC.some((pattern) => pattern.test(entry.path)));
      expect(expected.length, typeId).toBeGreaterThan(20);
      for (const { path, cell } of expected) expect(cell, `${typeId} ${path}`).toEqual({ status: "to-be-confirmed" });
    }
  });

  it("holds no digit in a new design except the version, the dates and the ISO class numbers", () => {
    for (const typeId of TOPS_IDS) {
      const found = leaves(withoutModels(packFor(start(typeId), { history: revisions(2) })), MODELS).filter((entry) =>
        DIGIT.test(String(entry.leaf)),
      );
      for (const { path, leaf } of found) {
        expect(DIGITS_ALLOWED.some((allowed) => allowed.test(path)), `${typeId} ${path} = ${String(leaf)}`).toBe(true);
      }
      expect(found.some((entry) => entry.path.endsWith(".iso"))).toBe(true);
    }
  });

  it("holds no number at all in the drawings of a new design, since it is not to scale", () => {
    const pack = packFor(start("crew-tee"));
    for (const view of pack.flats.views) {
      const texts = (view.model?.layers ?? []).flatMap((layer) => layer.elements).flatMap((element) => (element.kind === "text" ? [element.text] : []));
      expect(texts.filter((text) => DIGIT.test(text))).toEqual([]);
    }
  });

  it("gives the ISO numbers only to the stitch types and seam classes, as three digits and one digit", () => {
    const pack = packFor(start("polo"));
    for (const seam of pack.construction.seams) {
      expect(seam.seamClass.iso).toMatch(/^\d$/);
      expect(seam.stitchClass.iso).toMatch(/^\d{3}$/);
    }
  });
});

const CHECKED_WORDS = /\b(checked|verified|verify|approved|validated|reviewed|certified|signed)\b/i;

describe("suggestions are never shown as checked", () => {
  const suggested = (): GarmentSpec => {
    let spec = fullDesign("polo");
    const steps = [
      { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "ai-suggested" },
      { type: "set-measurement", pointId: "chest-width", value: 5200, provenance: "ai-suggested" },
      { type: "set-labelling", field: "origin", text: "Portugal", provenance: "read-from-image" },
    ];
    for (const step of steps) {
      const result = applyAction(spec, step);
      if (result.ok) spec = result.spec;
    }
    return spec;
  };

  it("has no field, flag or word meaning checked or verified, apart from the one sentence that says nobody has", () => {
    for (const spec of [start("polo"), fullDesign("polo"), suggested()]) {
      const document = JSON.stringify(withoutModels(packFor(spec, { charts: CHARTS })));
      const withoutStatement = document.replace("Nobody has checked this specification yet.", "");
      expect(withoutStatement).not.toMatch(CHECKED_WORDS);
      expect(withoutStatement).not.toMatch(/"(checked|verified|isChecked|isVerified|reviewed|approved|signedOff)"/i);
    }
  });

  it("keeps the sign-off empty and says so, whatever the design holds", () => {
    for (const spec of [start("polo"), fullDesign("polo"), suggested()]) {
      const { signOff } = packFor(spec);
      expect(signOff.name).toEqual({ status: "to-be-confirmed" });
      expect(signOff.date).toEqual({ status: "to-be-confirmed" });
      expect(signOff.statement).toBe("Nobody has checked this specification yet.");
    }
  });

  it("lists a suggested value on the suggested page and marks it with the source of the suggestion", () => {
    const pack = packFor(suggested());
    expect(pack.suggested.items.map((item) => item.provenance)).toEqual(expect.arrayContaining(["ai-suggested", "read-from-image"]));
    const fit = pack.cover.options.find((option) => option.id === "fit");
    expect(fit?.choice).toMatchObject({ provenance: "ai-suggested" });
  });
});
