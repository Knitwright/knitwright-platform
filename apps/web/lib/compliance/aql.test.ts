import { describe, expect, it } from "vitest";
import { EVERY_PIECE_SENTENCE, NO_PLAN_SENTENCE, planFindings, planFor, planSentence, qualityPlanLine } from "./aql";
import { SEEDED_AQL_PLANS, SEEDED_RUN_PLAN, agreedRunPlan } from "./fixtures/rows";
import type { AqlPlan } from "./rows";

const FACTORY = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("planFor", () => {
  it("takes the factory's own plan over the one that stands for every factory", () => {
    const own = agreedRunPlan({ factoryId: FACTORY });
    expect(planFor([SEEDED_RUN_PLAN, own], { factoryId: FACTORY, scope: "run" })).toBe(own);
  });

  it("falls back to the every-factory plan for a factory with none of its own", () => {
    const own = agreedRunPlan({ factoryId: OTHER });
    expect(planFor([SEEDED_RUN_PLAN, own], { factoryId: FACTORY, scope: "run" })).toBe(SEEDED_RUN_PLAN);
  });

  it("ignores a factory's own plan when no factory is chosen yet", () => {
    expect(planFor([agreedRunPlan({ factoryId: FACTORY }), SEEDED_RUN_PLAN], { factoryId: null, scope: "run" })).toBe(SEEDED_RUN_PLAN);
  });

  it("asks for a scope by name, and finds nothing where no row covers it", () => {
    expect(planFor(SEEDED_AQL_PLANS, { factoryId: null, scope: "class_a_sample" })?.inspectEveryPiece).toBe(true);
    expect(planFor([SEEDED_RUN_PLAN], { factoryId: null, scope: "class_a_sample" })).toBeNull();
  });
});

describe("planSentence", () => {
  it("quotes the seeded run plan's level, its limits, its source and its label", () => {
    const sentence = planSentence(SEEDED_RUN_PLAN);
    expect(sentence).toContain("Inspection level II, AQL 0.0 critical, 2.5 major and 4.0 minor");
    expect(sentence).toContain("Rulebook R-QC-001");
    expect(sentence).toContain("no factory has agreed");
  });

  it("leaves the label off a plan a factory has agreed", () => {
    const sentence = planSentence(agreedRunPlan());
    expect(sentence).toContain("Inspection level II");
    expect(sentence).not.toContain(agreedRunPlan().label);
  });

  it("says only what a row holds: every piece, with no level invented beside it", () => {
    const sentence = planSentence(SEEDED_AQL_PLANS[0]!);
    expect(sentence).toContain("Inspect every piece");
    expect(sentence).not.toMatch(/level/i);
    expect(sentence).not.toMatch(/\bAQL\b/);
  });

  it("names a level with no acceptance limits rather than making one up", () => {
    const plan: AqlPlan = { ...agreedRunPlan(), criticalAql: null, majorAql: null, minorAql: null };
    expect(planSentence(plan)).toContain("Inspection level II.");
    expect(planSentence(plan)).not.toMatch(/\bAQL\b/);
  });

  it("names the limits a row does hold and no others", () => {
    expect(planSentence({ ...agreedRunPlan(), criticalAql: null })).toContain("AQL 2.5 major and 4.0 minor");
  });

  it("carries no source sentence for a row with no source", () => {
    expect(planSentence({ ...agreedRunPlan(), source: null })).not.toContain("Source:");
  });
});

describe("qualityPlanLine", () => {
  it("inspects every piece for a Class A sample Knitwright makes, whatever any row says", () => {
    const line = qualityPlanLine([agreedRunPlan()], { factoryId: FACTORY, scope: "run" }, { classASampleMadeByKnitwright: true });
    expect(line).toBe(EVERY_PIECE_SENTENCE);
  });

  it("gives the run plan's own sentence for anything else", () => {
    const line = qualityPlanLine(SEEDED_AQL_PLANS, { factoryId: FACTORY, scope: "run" }, { classASampleMadeByKnitwright: false });
    expect(line).toBe(planSentence(SEEDED_RUN_PLAN));
  });

  it("says no plan is on file rather than naming a level nobody recorded", () => {
    const line = qualityPlanLine([], { factoryId: FACTORY, scope: "run" }, { classASampleMadeByKnitwright: false });
    expect(line).toBe(NO_PLAN_SENTENCE);
    expect(line).not.toMatch(/level/i);
  });
});

describe("planFindings", () => {
  it("warns, with the rule that explains the plan, when nobody has agreed the seeded figures", () => {
    const [found] = planFindings(SEEDED_AQL_PLANS, { factoryId: FACTORY, scope: "run" });
    expect(found).toMatchObject({ code: "aql_plan_unconfirmed", severity: "warning", ruleId: "R-QC-001", path: "quality.aqlPlan" });
    expect(found?.message).toContain("placeholder");
  });

  it("warns when no row covers the scope at all", () => {
    expect(planFindings([], { factoryId: null, scope: "run" })[0]).toMatchObject({ code: "aql_plan_missing", severity: "warning", ruleId: "R-QC-001" });
  });

  it("says nothing about a plan the factory has agreed", () => {
    expect(planFindings([agreedRunPlan({ factoryId: FACTORY })], { factoryId: FACTORY, scope: "run" })).toEqual([]);
  });

  it("never blocks: an unagreed plan is a note, because a refusal would stop the run that gets one agreed", () => {
    for (const found of planFindings(SEEDED_AQL_PLANS, { factoryId: null, scope: "run" })) expect(found.severity).toBe("warning");
  });
});
