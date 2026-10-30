import { describe, expect, it } from "vitest";
import { readArticleJson } from "@/lib/catalogue/fixtures/source";
import { fixtureRows, FIXTURE_CONSUMPTION, programmeColours } from "../fixtures/rows";
import { checkPackage } from "../gate";
import { GRADE_TYPES } from "../model";
import { buildKppInput } from "./build";

/**
 * The real `KppInput` builder over the rows X1, X4 and X6 really seed (plan v5 X5b item 1). Nothing here is a
 * stub: the article is the catalogue's own `JSY-SS-01`, the design object is X4's export of a stored design, and
 * the factory, fabric, colour and country rows are X6's.
 */

const built = () => buildKppInput(fixtureRows());

const fieldOf = (id: string) => built().fields.find((field) => field.id === id);

describe("the design, the article and the factory", () => {
  it("takes the size run and the base size from the article, not from the design", () => {
    const input = built();
    expect(input.design.sizes).toEqual(["XS", "S", "M", "L", "XL", "2XL", "3XL"]);
    expect(input.design.baseSize).toBe("M");
    expect(input.design.articleCode).toBe("JSY-SS-01");
  });

  it("names the factory from its row and takes the print file type from what it accepts", () => {
    const input = built();
    expect(input.factory.name).toBe("Sialkot partner (placeholder)");
    expect(input.factory.code).toBe("SIALKOT-PARTNER");
    expect(input.factory.printFileType).toBe("pdf");
  });

  it("gives every overview field a rule id and a provenance, and no field is `confirmed`", () => {
    for (const field of built().fields) {
      expect(field.ruleId, field.id).toMatch(/^R-[A-Z]+-\d{3}$/);
      expect(["from_base", "from_design", "needs_input"], field.id).toContain(field.provenance);
    }
  });

  it("reads the brand's own choices as from_design and the catalogue's as from_base", () => {
    expect(fieldOf("style_name")).toMatchObject({ value: "Home kit 2027", provenance: "from_design" });
    expect(fieldOf("production_class")).toMatchObject({ value: "A", provenance: "from_base" });
    expect(fieldOf("base_article")?.value).toContain("JSY-SS-01");
  });

  it("states the fabric from the programme row, with its blend and its weight", () => {
    expect(fieldOf("fabric")?.value).toBe("F-POLY-INT, Polyester interlock, 100% polyester, 140-160 gsm");
    expect(fieldOf("fabric")?.ruleId).toBe("R-SUB-001");
  });

  it("carries one field per option group and one per parameter, with the catalogue's rule", () => {
    const input = built();
    expect(input.fields.filter((field) => field.id.startsWith("option_")).map((field) => field.id)).toEqual([
      "option_collar",
      "option_pattern_fill",
      "option_sleeve_finish",
    ]);
    const offset = input.fields.find((field) => field.id === "parameter_body_length_offset");
    expect(offset).toMatchObject({ value: "10 mm", provenance: "from_design" });
    expect(offset?.ruleId).toMatch(/^R-/);
  });

  it("writes a catalogue code where the design's choice is one", () => {
    const rows = fixtureRows();
    const object = { ...rows.object, article: { ...rows.object.article, options: { ...rows.object.article.options, collar: "C02" } } };
    const mapped = buildKppInput({ ...rows, object }).fields.find((field) => field.id === "option_collar");

    expect(mapped?.value).toMatch(/^C02 /);
    expect(mapped?.provenance).toBe("from_design");
    expect(mapped?.ruleId).toBe("R-CON-005");
  });

  /**
   * The option code map (decision 0099). The fixture design is a registry design, so its options are the
   * registry's own words; the map turns the ones a published source joins to a code into that code, and says
   * plainly where it has none.
   */
  it("turns the design's own word into a catalogue code where a published source joins the two", () => {
    const fields = built().fields;
    expect(fields.find((field) => field.id === "option_collar")).toMatchObject({
      // The design's `neckline: "crew"`, which the map joins to C01. Its own `collar: "none"` is another question.
      value: "C01 Crew neck, 1x1 rib, 20 mm finished",
      provenance: "from_design",
      ruleId: "R-CON-004",
    });
    expect(fields.find((field) => field.id === "option_sleeve_finish")).toMatchObject({
      value: "K01 Coverstitch hem, 20 mm",
      provenance: "from_design",
      ruleId: "R-CON-007",
    });
  });

  it("says there is no code, rather than writing the design's own word as one, when the map has none", () => {
    const rows = fixtureRows({ optionCodeMap: [] });
    const collar = buildKppInput(rows).fields.find((field) => field.id === "option_collar");
    expect(collar).toMatchObject({ provenance: "from_design", ruleId: "R-GAP-000" });
    expect(collar?.value).toContain("No catalogue code yet");
    // The design's word appears only inside that sentence, never where a code belongs.
    expect(collar?.value).not.toMatch(/^[A-Z][0-9]{2}|^none/);
  });

  it("says plainly that the catalogue has no code for a choice nothing published joins to one", () => {
    const rows = fixtureRows();
    const options = { ...rows.object.article.options, collar: "band-collar", placket: "zip" };
    const fields = buildKppInput({ ...rows, object: { ...rows.object, article: { ...rows.object.article, options } } }).fields;
    const stand = fields.find((field) => field.id === "design_option_collar");

    expect(stand).toMatchObject({ label: "Design option: collar", provenance: "from_design", ruleId: "R-GAP-000" });
    expect(stand?.value).toBe(
      'No catalogue code yet: the design asked for "band-collar" under the design option "collar", and nothing published joins it to a code.',
    );
    expect(fields.find((field) => field.id === "design_option_placket")?.value).toContain('asked for "zip"');
    // The band collar does not become the neck finish: that group still reads the neckline the design chose.
    expect(fields.find((field) => field.id === "option_collar")?.value).toMatch(/^C01 /);
  });

  it("writes no field a factory would read whose value is a code the catalogue never approved", () => {
    const codes = new Set(fixtureRows().article.options.map((option) => option.code));
    for (const field of built().fields) {
      const named = /\b([A-Z][0-9]{2})\b/.exec(field.value ?? "");
      if (named !== null) expect(codes, field.id).toContain(named[1]);
    }
  });

  it("says in the README notes where every value came from and what is still a draft", () => {
    const notes = built().notes.join(" ");
    expect(notes).toContain("not reviewed by a factory");
    expect(notes).toContain("D65");
    expect(notes).toContain("sRGB");
  });
});

describe("the points of measure (owner decision 18)", () => {
  it("takes every POM of the article with its grade, its tolerance and its value in every size", () => {
    const poms = built().poms;
    const article = readArticleJson().pom as { letter: string; values: Record<string, number> }[];
    expect(poms).toHaveLength(article.length);
    const chest = poms.find((pom) => pom.letter === "A");
    expect(chest).toMatchObject({ code: "CH", gradeMm: 30, tolMinusMm: 10, tolPlusMm: 10 });
    expect(chest?.values).toMatchObject({ XS: 460, M: 520, "3XL": 640 });
    for (const pom of poms) expect(GRADE_TYPES, pom.letter).toContain(pom.gradeType);
  });

  it("marks every POM as the base article's own data, never as confirmed by a factory", () => {
    for (const pom of built().poms) expect(pom.provenance).toBe("from_base");
  });

  it("does not give a POM with no tolerance one, and the gate then refuses the package", () => {
    const article = fixtureArticleWithoutTolerance();
    const input = buildKppInput(fixtureRows({ article }));
    const pom = input.poms.find((row) => row.letter === "A");

    expect(pom?.tolMinusMm).toBeNull();
    expect(pom?.tolPlusMm).toBeNull();
    const refusals = checkPackage(input).filter((issue) => issue.path === "poms[0].tolerance");
    expect(refusals).toHaveLength(1);
    expect(refusals[0]?.message).toContain("no tolerance");
  });

  it("leaves a size the article has no value for empty, and the gate names that size", () => {
    const base = fixtureRows().article;
    const poms = base.poms.map((pom, index) => (index === 0 ? { ...pom, valuesMm: { ...pom.valuesMm, "3XL": undefined as unknown as number } } : pom));
    const input = buildKppInput(fixtureRows({ article: { ...base, poms } }));

    expect(input.poms[0]?.values["3XL"]).toBeNull();
    expect(checkPackage(input).map((issue) => issue.message).join(" ")).toContain("no value for 3XL");
  });
});

/** The catalogue's chest POM with its tolerance taken away, which `article_poms` itself would refuse to store. */
function fixtureArticleWithoutTolerance() {
  const article = fixtureRows().article;
  const poms = article.poms.map((pom, index) =>
    index === 0 ? ({ ...pom, tolMinusMm: null, tolPlusMm: null } as unknown as (typeof article.poms)[number]) : pom,
  );
  return { ...article, poms };
}

describe("the bill of materials", () => {
  it("builds each line's specification from the catalogue and the programme fabric", () => {
    const bom = built().bom;
    const main = bom.find((row) => row.item === "Main fabric");
    expect(main?.spec).toContain("F-POLY-INT");
    expect(main?.spec).toContain("180 cm wide");
    expect(bom.map((row) => row.type)).toEqual(expect.arrayContaining(["fabric", "thread", "label"]));
  });

  it("takes each quantity from the consumption it was given, and never from a pattern or a guess", () => {
    const main = built().bom.find((row) => row.item === "Main fabric");
    expect(main).toMatchObject({ qtyPerPiece: "0.80", unit: "m", sizeDependent: true, provenance: "from_base" });
    expect(FIXTURE_CONSUMPTION.every((row) => row.label.includes("article.json"))).toBe(true);
  });

  it("leaves a line with no consumption on file empty and lets the gate refuse it", () => {
    const input = buildKppInput(fixtureRows({ unsourced: { ...fixtureRows().unsourced, consumption: [] } }));

    expect(input.bom.every((row) => row.qtyPerPiece === null && row.provenance === "needs_input")).toBe(true);
    expect(checkPackage(input).map((issue) => issue.message).join(" ")).toContain("no quantity");
  });
});

describe("the colour spec (owner decision 15)", () => {
  it("takes the roles and the Pantone codes from the design object and the fabric from the programme row", () => {
    const colour = built().colour;
    expect(colour.fabric).toBe("F-POLY-INT");
    expect(colour.colours.length).toBeGreaterThan(0);
    expect(colour.strikeOffRequired).toBe(true);
  });

  it("states the colour difference the factory agreed, and refuses rather than invent one when it has none", () => {
    expect(built().colour.tolerance).toEqual({ metric: "dE_CMC_2_1", max: 1.5 });

    const capability = fixtureRows().capability;
    const input = buildKppInput(fixtureRows({ capability: capability === null ? null : { ...capability, colourDeltaMax: null } }));
    expect(input.colour.tolerance.max).toBeNull();
    expect(checkPackage(input).map((issue) => issue.path)).toContain("colour.tolerance");
  });

  it("carries the fabric's swatch reference only for a colour the programme holds", () => {
    expect(built().colour.colours.every((colour) => colour.swatchId === "SW-INT-01")).toBe(true);

    const input = buildKppInput(fixtureRows({ fabricColours: programmeColours() }));
    expect(input.colour.colours.every((colour) => colour.swatchId === null)).toBe(true);
    expect(checkPackage(input).map((issue) => issue.message).join(" ")).toContain("no swatch ID");
  });
});

describe("the care labels", () => {
  it("makes one label per selling country, in the country rules' order", () => {
    expect(built().labels.map((label) => label.market)).toEqual(["GB", "AU"].map((code) => code.toLowerCase()));
  });

  it("takes the fibre content from the fabric's blend when no market wording states one", () => {
    const input = buildKppInput(fixtureRows({ unsourced: { ...fixtureRows().unsourced, labelWording: [] } }));

    expect(input.labels.every((label) => label.fibre === "100% polyester")).toBe(true);
    expect(input.labels.every((label) => label.care.length === 0)).toBe(true);
    expect(checkPackage(input).map((issue) => issue.message).join(" ")).toContain("missing care, origin, size");
  });

  it("asks for an importer only where the wording says the market needs one", () => {
    const labels = built().labels;
    expect(labels.find((label) => label.market === "gb")?.importerRequired).toBe(true);
    expect(labels.find((label) => label.market === "au")?.importerRequired).toBe(false);
  });
});

describe("the QC checklist (owner decision 19)", () => {
  it("inspects every piece for a Class A sample Knitwright makes", () => {
    expect(built().qc.aqlPlan).toContain("Inspect every piece");
  });

  it("uses the plan on the input for anyone else's sample", () => {
    const input = buildKppInput(fixtureRows({ madeByKnitwright: false }));
    expect(input.qc.aqlPlan).toBe("AQL 0 critical / 2.5 major / 4.0 minor, level II");
  });

  it("says so in words rather than naming a level nobody agreed, when there is no plan", () => {
    const rows = fixtureRows();
    const input = buildKppInput({ ...rows, madeByKnitwright: false, unsourced: { ...rows.unsourced, quality: { ...rows.unsourced.quality, aqlPlan: null } } });
    expect(input.qc.aqlPlan).toContain("No AQL plan is on file");
    expect(input.qc.aqlPlan).not.toMatch(/2\.5|4\.0/);
  });

  it("measures every POM of the article when the plan names none", () => {
    const rows = fixtureRows();
    const input = buildKppInput({ ...rows, unsourced: { ...rows.unsourced, quality: { ...rows.unsourced.quality, measure: [] } } });
    expect(input.qc.measure).toHaveLength(rows.article.poms.length);
  });

  it("states the space and the observer of the Lab numbers in the colour check", () => {
    expect(built().qc.colour).toContain("two-degree observer");
  });
});

describe("the print thresholds", () => {
  it("are the guardrail settings in force, so what the factory is told is what the platform makes", () => {
    expect(built().print).toMatchObject({ minDpi: 150, dpi: 150, minBleedMm: 10, bleedMm: 10 });
  });
});

describe("determinism", () => {
  it("gives the same input twice from the same rows", () => {
    expect(JSON.stringify(buildKppInput(fixtureRows()))).toBe(JSON.stringify(buildKppInput(fixtureRows())));
  });
});

describe("the gate over the real rows", () => {
  it("refuses nothing once the rows and the article's own draft values are all there", () => {
    expect(checkPackage(built())).toEqual([]);
  });

  it("refuses a batch with no orders, as it did with the fixture", () => {
    const input = buildKppInput(fixtureRows({ kind: "batch" }));
    expect(checkPackage(input).map((issue) => issue.path)).toContain("orders");
  });
});
