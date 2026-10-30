import { describe, expect, it } from "vitest";
import type { ArticleFabric, BaseArticle } from "@/lib/catalogue";
import type { CountryRule, ProgrammeFabric } from "@/lib/factory/schemas";
import { fixtureRows } from "../fixtures/rows";
import { checkPackage } from "../gate";
import { buildKppInput, buildNotes } from "./build";
import { colourSpec } from "./colour";
import { overviewFields } from "./fields";
import { careLabels, wordingFromRule } from "./labels";
import { billOfMaterials } from "./materials";
import { chosenFabric } from "./model";

/**
 * The rows that are missing, blank or in a shape the seed does not have. Each one is a row a factory or a colour
 * house has not filled in yet, and the answer is always the same: say so, never fill it in.
 */

const fieldsOf = (rows: Parameters<typeof overviewFields>[0]) => new Map(overviewFields(rows).map((field) => [field.id, field]));

describe("an article with nothing optional set", () => {
  const bare = (): BaseArticle => ({
    ...fixtureRows().article,
    fit: null,
    hsCode: null,
    origin: null,
    sampleSize: null,
    sourceNote: null,
    sourceVersion: null,
    options: [],
    parameters: [],
    thread: null,
    fabrics: [],
  });

  it("leaves out the fields nobody filled in rather than carrying a blank one", () => {
    const fields = fieldsOf(fixtureRows({ article: bare() }));

    for (const id of ["fit", "hs_code", "origin"]) expect(fields.has(id), id).toBe(false);
    expect(fields.get("brand")?.value).toBe("Acme FC");
  });

  it("leaves the base size blank when the article names no sample size, and the gate refuses", () => {
    const input = buildKppInput(fixtureRows({ article: bare() }));

    expect(input.design.baseSize).toBe("");
    expect(checkPackage(input).map((issue) => issue.path)).toContain("fields.base_size");
  });

  it("has no bill of materials beyond the care label, and the gate refuses that too", () => {
    const bom = billOfMaterials(fixtureRows({ article: bare() }));

    expect(bom.map((row) => row.type)).toEqual(["label"]);
    expect(checkPackage(buildKppInput(fixtureRows({ article: bare() }))).map((issue) => issue.message).join(" ")).toContain("no fabric line");
  });

  it("says in the notes that the article has no version of its own", () => {
    expect(buildNotes(fixtureRows({ article: bare() })).join(" ")).toContain("unversioned");
  });
});

describe("a design on a fabric the programme has no row for", () => {
  const rows = () => fixtureRows({ fabrics: [] });

  it("marks the fabric field as needing input and says so in the notes", () => {
    expect(fieldsOf(rows()).get("fabric")).toMatchObject({ value: null, provenance: "needs_input" });
    expect(buildNotes(rows()).join(" ")).toContain("No fabric row is on file");
    expect(chosenFabric(rows())).toBeNull();
  });

  it("names no fabric in the colour spec, asks for no strike-off, and the gate refuses", () => {
    const spec = colourSpec(rows());

    expect(spec.fabric).toBeNull();
    expect(spec.strikeOffRequired).toBe(false);
    expect(spec.colours.every((colour) => colour.swatchId === null)).toBe(true);
    expect(checkPackage(buildKppInput(rows())).map((issue) => issue.path)).toContain("colour.fabric");
  });

  it("falls back to no fibre content on the labels, because a blend is a fabric's own fact", () => {
    const input = buildKppInput(fixtureRows({ fabrics: [], unsourced: { ...fixtureRows().unsourced, labelWording: [] } }));
    expect(input.labels.every((label) => label.fibre === null)).toBe(true);
  });
});

describe("a factory with no agreed capability for the article", () => {
  const rows = () => fixtureRows({ capability: null });

  it("says so in the notes and asks the factory to record what it measured", () => {
    expect(buildNotes(rows()).join(" ")).toContain("no agreed capability on file");
    expect(buildKppInput(rows()).qc.colour).toContain("record what was measured");
  });

  it("still writes PDF print files, because that is what the platform makes", () => {
    expect(buildKppInput(rows()).factory.printFileType).toBe("pdf");
  });

  it("writes TIFF when the factory's capability says it takes them", () => {
    const capability = fixtureRows().capability;
    const rowsWithTif = fixtureRows({ capability: capability === null ? null : { ...capability, fileFormats: ["tif", "pdf"] } });
    expect(buildKppInput(rowsWithTif).factory.printFileType).toBe("tif");
  });
});

describe("country_rules.label_rules", () => {
  const rule = (labelRules: Record<string, unknown>): CountryRule => ({ ...fixtureRows().markets[0]!, labelRules });

  it("reads the wording a market's rules state, and ignores anything in another shape", () => {
    const wording = wordingFromRule(
      rule({ fibre: "100% Polyester", care: ["Wash 30 C", 7, ""], origin: "Made in Pakistan", size: "See size label", importer: "Acme FC", importer_required: true }),
    );

    expect(wording).toMatchObject({
      fibre: "100% Polyester",
      care: ["Wash 30 C"],
      origin: "Made in Pakistan",
      size: "See size label",
      importer: "Acme FC",
      importerRequired: true,
    });
  });

  it("reads nothing out of the empty object X6 seeded, and asks for no importer it was not told about", () => {
    expect(wordingFromRule(rule({}))).toMatchObject({ fibre: null, care: [], origin: null, size: null, importer: null, importerRequired: false });
    expect(wordingFromRule(rule({ fibre: "   ", care: "not a list", importer_required: "yes" }))).toMatchObject({ fibre: null, care: [], importerRequired: false });
  });

  it("lets a market's own rules win over wording supplied for it", () => {
    const rows = fixtureRows({ markets: [rule({ fibre: "Polyester 100 %", care: ["Cold wash"] })] });
    const label = careLabels(rows)[0];

    expect(label?.fibre).toBe("Polyester 100 %");
    expect(label?.care).toEqual(["Cold wash"]);
  });

  it("makes no label at all when no market is on file, and the gate refuses", () => {
    const input = buildKppInput(fixtureRows({ markets: [] }));

    expect(input.labels).toEqual([]);
    expect(checkPackage(input).map((issue) => issue.path)).toContain("labels");
  });
});

describe("a fabric row with nothing but a code", () => {
  it("writes no specification for it rather than repeating the code, and the gate refuses", () => {
    const rows = fixtureRows();
    const fabrics: readonly ArticleFabric[] = [{ code: "F-POLY-INT", role: null, description: null, gsm: null, widthCm: null, pressShrinkLengthPct: null, pressShrinkWidthPct: null, sourceNote: null }];
    const bare = fixtureRows({ article: { ...rows.article, fabrics }, fabrics: [] });

    const bom = billOfMaterials(bare);

    expect(bom[0]).toMatchObject({ item: "Fabric F-POLY-INT", spec: null });
    expect(checkPackage(buildKppInput(bare)).map((issue) => issue.message).join(" ")).toContain("no specification");
  });

  it("states one weight when the programme gives one figure rather than a range", () => {
    const rows = fixtureRows();
    const one: ProgrammeFabric = { ...chosenFabric(rows)!, gsmMax: null };
    expect(fieldsOf(fixtureRows({ fabrics: [one] })).get("fabric")?.value).toContain("140 gsm");
  });
});

describe("a parameter the design did not set", () => {
  it("shows the article's own default, as the article's data", () => {
    const rows = fixtureRows();
    const object = { ...rows.object, article: { ...rows.object.article, parameters: {} } };
    const field = fieldsOf({ ...rows, object }).get("parameter_body_length_offset");

    expect(field).toMatchObject({ provenance: "from_base" });
    expect(field?.value).toMatch(/^-?\d+ mm$/);
  });

  it("writes a yes or a no for a parameter that is a flag", () => {
    const rows = fixtureRows();
    const parameters = [
      { key: "side_split", type: "bool" as const, min: null, max: null, step: null, defaultValue: false, enumValues: null, unit: null, affectsPanels: [], pomLetters: [], ruleId: "R-PAT-004", approvedBySampleId: null },
    ];
    const fields = fieldsOf(fixtureRows({ article: { ...rows.article, parameters } }));

    expect(fields.get("parameter_side_split")?.value).toBe("no");
    const chosen = { ...rows.object, article: { ...rows.object.article, parameters: { side_split: true } } };
    expect(fieldsOf({ ...fixtureRows({ article: { ...rows.article, parameters } }), object: chosen }).get("parameter_side_split")?.value).toBe("yes");
  });
});

describe("a batch package", () => {
  it("carries the orders, the names and the packing lines, which a sample does not", () => {
    const rows = fixtureRows({
      kind: "batch",
      orders: [{ orderNo: "KW10422", sizes: { M: 2 }, dueDate: "2026-11-20" }],
      personalisation: [{ orderNo: "KW10422", lineId: "L1", size: "M", name: "SMITH", number: "7", nameZone: "back_name", numberZone: "back_number", fontId: "kw-block-01", colourHex: "#FFFFFF" }],
    });

    const batch = buildKppInput(rows);
    expect(batch.orders).toHaveLength(1);
    expect(batch.personalisation).toHaveLength(1);
    expect(batch.packing).toEqual(["Fold flat and bag each order separately."]);
    expect(checkPackage(batch)).toEqual([]);

    // The same rows as a sample carry neither, whatever was passed in.
    const sample = buildKppInput({ ...rows, kind: "sample" });
    expect(sample.orders).toEqual([]);
    expect(sample.personalisation).toEqual([]);
  });

  it("is not a Class A sample, so it uses the AQL plan rather than inspecting every piece", () => {
    expect(buildKppInput(fixtureRows({ kind: "batch" })).qc.aqlPlan).toContain("AQL 0 critical");
  });
});

describe("an article with no options and no parameters", () => {
  it("writes no option or parameter fields at all", () => {
    const rows = fixtureRows();
    const fields = overviewFields(fixtureRows({ article: { ...rows.article, options: [], parameters: [] } }));
    expect(fields.some((field) => field.id.startsWith("option_") || field.id.startsWith("parameter_"))).toBe(false);
  });

  it("falls back to the first option of a group where none is the default", () => {
    const rows = fixtureRows();
    const options = rows.article.options.filter((option) => option.group === "collar").map((option) => ({ ...option, isDefault: false }));
    const object = { ...rows.object, article: { ...rows.object.article, options: {} } };
    const fields = overviewFields({ ...fixtureRows({ article: { ...rows.article, options } }), object });

    expect(fields.find((field) => field.id === "option_collar")).toMatchObject({ provenance: "from_base" });
  });
});
