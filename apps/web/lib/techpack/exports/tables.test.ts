import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { PROVENANCE_LABELS } from "@/lib/garment";
import { CHARTS, TOPS_IDS, fullDesign, packFor, revisions } from "../fixtures/designs";
import { benchmarkJerseyInput, completeProduction, targetedJersey } from "../fixtures/production";
import { ALL_KINDS_STACK, ASSETS, PICTURE_ACCEPTED, PICTURE_STACK, SMALL_CREST, withStack } from "../fixtures/stacks";
import { SECTION_IDS, SECTION_TITLES, type TechPack } from "../types";
import { PROPOSAL_WORDS } from "../text";
import { STANDARD_CHOICE } from "../cell";
import { allCells } from "../walk";
import { EXCEL_SHEETS, sourceWords } from "./contents";
import { exportSections, type Datum, type ExportSection } from "./tables";

const cellsOf = (sections: readonly ExportSection[]): unknown[] =>
  sections.flatMap((section) =>
    section.tables.flatMap((table) => table.rows.flatMap((row) => row.flatMap((datum) => ("cell" in datum && datum.cell ? [datum.cell] : [])))),
  );

const designs = (): readonly (readonly [string, TechPack])[] => [
  ["jersey with every production record", packFor(targetedJersey(), { production: completeProduction() })],
  ["jersey with a stack of every layer kind", packFor(withStack(ALL_KINDS_STACK), { production: { ...completeProduction(), assets: ASSETS } })],
  ["jersey with a small picture", packFor(withStack(ALL_KINDS_STACK), { production: { ...completeProduction(), assets: [SMALL_CREST] } })],
  ["jersey read from a picture", packFor(withStack(PICTURE_STACK), { production: { ...completeProduction(), assets: ASSETS, picture: PICTURE_ACCEPTED } })],
  ["jersey with a pattern and nothing else", packFor(targetedJersey(), { production: benchmarkJerseyInput() })],
  ...TOPS_IDS.flatMap((typeId) => [
    [`${typeId} empty`, packFor(start(typeId))] as const,
    [`${typeId} full`, packFor(fullDesign(typeId), { history: revisions(3), charts: CHARTS })] as const,
  ]),
];

describe("the artwork and colour tables of a design with a stack", () => {
  const section = (pack: TechPack) => exportSections(pack).find((entry) => entry.id === "artwork-and-colour")!;
  const titles = (pack: TechPack) => section(pack).tables.map((table) => table.title);

  it("hold the layers, their placement, the repeat spec and the pictures, and the sentence that describes the design", () => {
    const pack = packFor(withStack(ALL_KINDS_STACK), { production: { ...completeProduction(), assets: ASSETS } });
    expect(titles(pack)).toEqual([
      "Colour standards", "Layers, bottom to top", "Clear space around placed pictures", "Placement of layers on every size", "Repeat spec", "Pictures and their resolution", "Repeat sizes", "Repeat settings",
      "Zones and clear space", "Placement on every size", "Print rules", "Settings the print files were made with",
    ]);
    expect(section(pack).paragraphs.join(" ")).toContain("Polka dots in");
    const repeat = section(pack).tables.find((table) => table.title === "Repeat spec")!;
    expect(repeat.rows).toHaveLength(2);
    expect(JSON.parse((repeat.rows[0]?.[5] as { text: string }).text).generatorId).toBe("kit-dots");
  });

  it("add the read-from-a-picture table, with the limits and the acceptance, when the design was read from a picture", () => {
    const pack = packFor(withStack(PICTURE_STACK), { production: { ...completeProduction(), assets: ASSETS, picture: PICTURE_ACCEPTED } });
    const table = section(pack).tables.find((entry) => entry.title === "Read from a picture")!;
    const labels = table.rows.map((row) => (row[0] as { text: string }).text);
    expect(labels).toEqual(expect.arrayContaining(["What this is", "Limit", "Left empty", "Guessed"]));
    expect(titles(packFor(targetedJersey()))).not.toContain("Read from a picture");
  });

  it("have no layer tables for a design without a stack", () => {
    expect(titles(packFor(targetedJersey(), { production: completeProduction() }))).not.toContain("Layers, bottom to top");
  });
});

describe("the tables every format is made from", () => {
  it("has a section for each one of the document, in order, with the title of the document", () => {
    const sections = exportSections(packFor(start("crew-tee")));
    expect(sections.map((section) => section.id)).toEqual([...SECTION_IDS]);
    expect(sections.map((section) => section.title)).toEqual(SECTION_IDS.map((id) => SECTION_TITLES[id]));
  });

  it("holds every cell of the document exactly once, for every tops type, empty and full", () => {
    for (const [label, pack] of designs()) {
      const inTables = cellsOf(exportSections(pack));
      const inDocument = allCells(pack).map((entry) => entry.cell);
      expect(inTables.length, label).toBe(inDocument.length);
      // A cell that is set is its own object, so each one must be found once and only once.
      const set = inDocument.filter((cell) => cell.status === "set");
      for (const cell of set) expect(inTables.filter((found) => found === cell).length, `${label} ${JSON.stringify(cell)}`).toBe(1);
    }
  });

  it("gives every row one datum for each column, of the kind the column says", () => {
    for (const [label, pack] of designs()) {
      for (const section of exportSections(pack)) {
        for (const table of section.tables) {
          for (const row of table.rows) {
            expect(row.map((datum) => datum.kind), `${label} ${section.id}`).toEqual(table.columns.map((column) => column.kind));
          }
        }
      }
    }
  });

  it("names a sheet only for the sections that hold values", () => {
    const sections = exportSections(packFor(fullDesign("crew-tee")));
    expect(sections.map((section) => section.sheet)).toEqual(SECTION_IDS.map((id) => EXCEL_SHEETS[id]));
    expect(sections.filter((section) => section.sheet === null).map((section) => section.id)).toEqual(["flats", "how-to-measure"]);
  });

  it("keeps the base size marked in the measurement columns and gives a length column for each size", () => {
    const pack = packFor(fullDesign("crew-tee"));
    const table = exportSections(pack).find((section) => section.id === "measurements")?.tables[0];
    const headers = table?.columns.map((column) => column.header) ?? [];
    expect(headers.slice(0, 3)).toEqual(["Code", "Measurement", "Tolerance"]);
    expect(headers.slice(3)).toEqual(["S", "M (base size)", "L"]);
    expect(table?.columns.slice(2).every((column) => column.kind === "length")).toBe(true);
  });

  it("puts the row notes in a table of notes by code, kept apart from the measurement table and its sentences", () => {
    const pack = packFor(start("crew-tee"));
    const measurements = exportSections(pack).find((section) => section.id === "measurements");
    const notes = pack.measurements.groups.flatMap((group) => group.rows.flatMap((row) => row.notes));
    expect(notes.length).toBeGreaterThan(0);
    const [table] = measurements?.notes ?? [];
    expect(table?.title).toBe("Measurement notes");
    expect(table?.columns.map((column) => column.header)).toEqual(["Code", "Measurement", "Note"]);
    const codes = table?.rows.flatMap((row) => (row[0]?.kind === "text" ? row[0].text.split(", ") : [])) ?? [];
    for (const row of pack.measurements.groups.flatMap((group) => group.rows)) expect(codes).toContain(row.code);
    for (const note of notes) expect(measurements?.paragraphs).not.toContain(note);
    for (const section of exportSections(pack).filter((entry) => entry.id !== "measurements")) expect(section.notes ?? []).toEqual([]);
  });

  it("has no table of notes when no row has a note", () => {
    const pack = packFor(fullDesign("crew-tee"), { charts: CHARTS });
    const empty = { ...pack, measurements: { ...pack.measurements, groups: pack.measurements.groups.map((group) => ({ ...group, rows: group.rows.map((row) => ({ ...row, notes: [] })) })) } };
    expect(exportSections(empty).find((section) => section.id === "measurements")?.notes).toEqual([]);
  });

  it("says a part that is not described is to be confirmed, and prints the proposal words for a proposal", () => {
    const pack = packFor(start("crew-tee"));
    const components = exportSections(pack).find((section) => section.id === "components");
    const others = components?.tables.find((table) => table.title === "Rib, thread, labels and trims");
    const proposals = others?.rows.flatMap((row) => row.filter((datum): datum is Extract<Datum, { kind: "value" }> => datum.kind === "value" && datum.cell !== null && "proposal" in datum.cell));
    expect(proposals?.length).toBeGreaterThan(0);
  });

  it("marks every column that holds a number with its unit words", () => {
    const pack = packFor(fullDesign("crew-tee"));
    const components = exportSections(pack).find((section) => section.id === "components");
    const weight = components?.tables[0]?.columns.find((column) => column.kind === "number");
    expect(weight).toMatchObject({ header: "Weight", unit: "grams per square metre" });
    const artwork = exportSections(pack).find((section) => section.id === "artwork")?.tables[0];
    expect(artwork?.columns.find((column) => column.kind === "number")).toMatchObject({ header: "Turn", unit: "degrees" });
  });

  it("says where each cell came from in words, with the proposal words for a proposal", () => {
    expect(sourceWords({ status: "set", value: "x", provenance: "user-edited" })).toBe(PROVENANCE_LABELS["user-edited"]);
    expect(sourceWords({ status: "set", value: "x", provenance: "derived", proposal: true } as never)).toBe(PROPOSAL_WORDS);
    expect(sourceWords({ status: "to-be-confirmed" })).toBeNull();
    expect(sourceWords({ status: "set", value: "Polo collar", provenance: "derived", standard: true } as never)).toBe(STANDARD_CHOICE);
    expect(STANDARD_CHOICE).toBe("Standard choice");
  });

  it("refuses a number whose unit differs from the column, so the header can never say the wrong unit", () => {
    const pack = packFor(fullDesign("crew-tee"));
    const first = pack.components.fabrics[0];
    if (!first || first.weight.status !== "set") throw new Error("The fixture has no weight.");
    const changed = {
      ...pack,
      components: { ...pack.components, fabrics: [{ ...first, weight: { ...first.weight, unit: "ounces" } }, ...pack.components.fabrics.slice(1)] },
    };
    expect(() => exportSections(changed)).toThrow(/ounces/);
  });
});
