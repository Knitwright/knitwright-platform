import { describe, expect, it } from "vitest";
import { readArticleJson } from "../fixtures/source";
import { DRAFT_LABEL, RULE_GAP, RULE_ID } from "../vocabulary";
import { articleJsonSchema, baseArticleFromJson, isoStitchClasses } from "./article-json";
import { JSY_SS_01_EXTRAS } from "./launch";

const json = articleJsonSchema.parse(readArticleJson());
const rib = json.fabrics.rib!;
const body = json.fabrics.body!;
const article = baseArticleFromJson(json, JSY_SS_01_EXTRAS);

describe("JSY-SS-01 read from its article.json", () => {
  it("keeps the article's facts and labels them as Knitwright's unreviewed draft", () => {
    expect(article).toMatchObject({
      code: "JSY-SS-01",
      name: json.name,
      articleType: "JSY",
      productionClass: json.class,
      status: "draft",
      sportTags: json.sports,
      uses: json.uses,
      sizeRange: json.sizes,
      sampleSize: json.base_size,
      hsCode: json.hs_code,
      origin: json.origin,
      sourceVersion: json.version,
      sourceNote: json.note,
      dataLabel: DRAFT_LABEL,
      fit: "regular",
      genders: [],
      registryTypeId: "football-shirt",
    });
    expect(DRAFT_LABEL).toBe("Knitwright draft v0.1, not reviewed by a factory");
  });

  it("carries every point of measure, value for value, in the file's order", () => {
    expect(article.poms).toHaveLength(json.pom.length);
    json.pom.forEach((pom, index) => {
      expect(article.poms[index]).toEqual({
        letter: pom.letter,
        code: pom.code,
        description: pom.description,
        gradeType: pom.grade_type,
        gradeMm: pom.grade,
        tolMinusMm: pom.tol,
        tolPlusMm: pom.tol,
        valuesMm: pom.values,
        ruleId: pom.rule,
      });
    });
  });

  it("has a value in every size for every point of measure", () => {
    for (const pom of article.poms) expect(Object.keys(pom.valuesMm).sort()).toEqual([...json.sizes].sort());
  });

  it("carries every parameter range as written, none of them sampled yet", () => {
    expect(article.parameters).toHaveLength(json.parameters.length);
    json.parameters.forEach((parameter, index) => {
      expect(article.parameters[index]).toEqual({
        key: parameter.key,
        type: "range",
        min: parameter.min,
        max: parameter.max,
        step: parameter.step,
        defaultValue: parameter.default,
        enumValues: null,
        unit: "mm",
        affectsPanels: parameter.affects,
        pomLetters: parameter.pom,
        ruleId: parameter.rule,
        approvedBySampleId: null,
      });
      expect(parameter.approved).toBe(false);
    });
  });

  it("carries every option by group and catalogue code, unpriced, with the file's rule or none", () => {
    const expected = Object.entries(json.options).flatMap(([group, list]) =>
      list.map((option) => ({ group, code: option.code, label: option.name, isDefault: option.default === true, ruleId: option.rule ?? RULE_GAP })),
    );
    expect(article.options.map(({ group, code, label, isDefault, ruleId }) => ({ group, code, label, isDefault, ruleId }))).toEqual(expected);
    expect(article.options.every((option) => option.extraCostMinor === null && option.currency === null && option.thumbnailKey === null)).toBe(true);
  });

  it("gives every option, range, measure and seam a rule id, and R-GAP-000 only where the file names none", () => {
    const ids = [
      ...article.options.map((option) => option.ruleId),
      ...article.parameters.map((parameter) => parameter.ruleId),
      ...article.poms.map((pom) => pom.ruleId),
      ...article.construction.map((row) => row.ruleId),
      article.thread!.ruleId,
      article.seamAllowances!.ruleId,
    ];
    expect(ids.every((id) => RULE_ID.test(id))).toBe(true);
    expect(article.options.filter((option) => option.ruleId === RULE_GAP).map((option) => option.code)).toEqual(["P00", "P01", "P02"]);
  });

  it("carries the construction table, the thread and the seam allowances", () => {
    expect(article.construction.map(({ step, seam, operation, ruleId }) => ({ n: step, seam, operation, rule: ruleId }))).toEqual(
      json.construction.map(({ n, seam, operation, rule }) => ({ n, seam, operation, rule })),
    );
    expect(article.construction.map((row) => row.spi)).toEqual(json.construction.map((row) => (row.spi === "" ? null : row.spi)));
    expect(article.thread).toEqual({ needle: json.thread.needle, looper: json.thread.looper, ruleId: json.thread.rule });
    const { rule, ...mm } = json.seam_allowance;
    expect(article.seamAllowances).toEqual({ mm, ruleId: rule });
  });

  it("carries both fabrics with their roles", () => {
    expect(article.fabrics).toEqual([
      {
        code: body.code, role: "body", description: body.description, gsm: body.gsm,
        widthCm: body.width_cm, pressShrinkLengthPct: body.press_shrink_length_pct,
        pressShrinkWidthPct: body.press_shrink_width_pct, sourceNote: body.status,
      },
      {
        code: rib.code, role: "rib", description: rib.description, gsm: rib.gsm,
        widthCm: null, pressShrinkLengthPct: null, pressShrinkWidthPct: null, sourceNote: rib.status,
      },
    ]);
  });

  it("leaves what the file does not hold empty: 3D model, panel map and script", () => {
    expect([article.glbModelKey, article.uvPanelMap, article.parametricScriptId, article.parametricScriptVersion]).toEqual([null, null, null, null]);
  });

  it("refuses a file in another unit or with a rule id that is not one", () => {
    expect(() => baseArticleFromJson({ ...json, units: "in" }, JSY_SS_01_EXTRAS)).toThrow();
    expect(() => baseArticleFromJson({ ...json, pom: [{ ...json.pom[0], rule: "fit-1" }] }, JSY_SS_01_EXTRAS)).toThrow();
  });

  it("reads a file with no rib fabric and an option with no rule", () => {
    const plain = baseArticleFromJson({ ...json, fabrics: { body }, options: { fill: [{ code: "P00", name: "Plain" }] } }, JSY_SS_01_EXTRAS);
    expect(plain.fabrics.map((fabric) => fabric.role)).toEqual(["body"]);
    expect(plain.options).toEqual([expect.objectContaining({ code: "P00", isDefault: false, ruleId: RULE_GAP })]);
  });
});

describe("ISO stitch classes in an operation", () => {
  it("are read as written, once each, and none are invented", () => {
    expect(isoStitchClasses("4-thread overlock (ISO 514), sleeve set in flat")).toEqual(["514"]);
    expect(isoStitchClasses("ISO 406 then ISO 406 and ISO 504")).toEqual(["406", "504"]);
    expect(isoStitchClasses("Rib joined into a loop with a 6 mm seam, 4-thread overlock")).toEqual([]);
  });
});
