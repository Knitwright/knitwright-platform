import { describe, expect, it } from "vitest";
import { defaultFactoryProfile } from "../profile";
import type { ParameterDef } from "../ports";
import type { DesignInput } from "../registry";
import { parametersInRange } from "./parameters";

/**
 * F-0 "article offered" and "parameters in range" (spec decision 5). The ranges are the worked article's
 * (docs/spec/articles/JSY-SS-01), each answering to its own rulebook rule.
 */

const DEFS: readonly ParameterDef[] = [
  { key: "body_length_offset", type: "range", min: -30, max: 40, step: 10, ruleId: "R-PAT-003" },
  { key: "sleeve_length_offset", type: "range", min: -20, max: 40, step: null, ruleId: "R-PAT-004" },
  { key: "collar", type: "enum", values: ["C01", "C02", "C03"], ruleId: "R-CON-004" },
  { key: "side_split", type: "bool", ruleId: null },
];

const profile = defaultFactoryProfile();
const article = (parameters: Readonly<Record<string, number | string | boolean>>) => ({
  baseArticleCode: "JSY-SS-01",
  productionClass: "A" as const,
  parameters,
});
const design = (parameters: Readonly<Record<string, number | string | boolean>>, extra: Partial<DesignInput> = {}): DesignInput => ({
  typeId: "team-jersey",
  readiness: null,
  article: article(parameters),
  parameterDefs: DEFS,
  ...extra,
});
const run = (input: DesignInput) => parametersInRange.run(input, profile);
const codes = (input: DesignInput) => run(input).map((found) => found.code);

describe("parameters in range", () => {
  it("finds nothing when every value is one the article approves", () => {
    expect(run(design({ body_length_offset: 20, sleeve_length_offset: 0, collar: "C02", side_split: true }))).toEqual([]);
  });

  it("finds nothing for a design with no parameters at all", () => {
    expect(run(design({}))).toEqual([]);
  });

  it("blocks a value outside the range, and names the range the factory makes", () => {
    const [found] = run(design({ body_length_offset: 50 }));
    expect(found).toMatchObject({ code: "parameter-out-of-range", severity: "blocker", article: "team-jersey", ruleId: "R-PAT-003" });
    expect(found?.message).toContain("-30 to 40");
    expect(found?.fix.action).toContain("between -30 and 40");
  });

  it("blocks a value between the steps the range moves in", () => {
    expect(codes(design({ body_length_offset: 5 }))).toEqual(["parameter-off-step"]);
    expect(codes(design({ body_length_offset: 0 }))).toEqual([]);
    expect(codes(design({ body_length_offset: -20 }))).toEqual([]);
  });

  it("allows any value in a range with no step", () => {
    expect(codes(design({ sleeve_length_offset: 7.5 }))).toEqual([]);
  });

  it("blocks a choice the article does not offer, and lists the choices", () => {
    const [found] = run(design({ collar: "C09" }));
    expect(found).toMatchObject({ code: "parameter-not-offered", ruleId: "R-CON-004" });
    expect(found?.fix.action).toBe("Pick one of: C01, C02, C03.");
  });

  it("blocks a value of the wrong kind", () => {
    expect(codes(design({ body_length_offset: "20" }))).toEqual(["parameter-wrong-type"]);
    expect(codes(design({ collar: 1 }))).toEqual(["parameter-wrong-type"]);
    expect(codes(design({ side_split: "yes" }))).toEqual(["parameter-wrong-type"]);
  });

  it("blocks a parameter the article has never heard of", () => {
    const [found] = run(design({ hood_depth: 50 }));
    expect(found).toMatchObject({ code: "parameter-unknown", ruleId: "R-GAP-000" });
    expect(found?.message).toContain("JSY-SS-01");
  });

  it("reports every problem, sorted by parameter name, so the list never moves about", () => {
    const input = design({ collar: "C09", body_length_offset: 50, hood_depth: 1 });
    expect(codes(input)).toEqual(["parameter-out-of-range", "parameter-not-offered", "parameter-unknown"]);
    expect(codes(input)).toEqual(codes(input));
  });

  it("blocks an article the catalogue does not offer", () => {
    const [found] = run(design({ collar: "C01" }, { parameterDefs: null }));
    expect(found).toMatchObject({ code: "article-not-offered", severity: "blocker" });
    expect(found?.message).toBe("Base article JSY-SS-01 is not in the catalogue.");
  });

  it("warns, rather than blocks, a design that sits on no base article yet", () => {
    const [found] = run({ typeId: "team-jersey", readiness: null, article: null, parameterDefs: null });
    expect(found).toMatchObject({ code: "article-not-set", severity: "warning", ruleId: "R-GAP-000" });
  });

  it("says nothing about a design whose article was never looked up", () => {
    expect(run({ typeId: "team-jersey", readiness: null })).toEqual([]);
  });
});
