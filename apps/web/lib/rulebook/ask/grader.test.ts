import { describe, expect, it } from "vitest";
import { gradeAnswer, lookupOf, NOT_COVERED } from "./grader";
import {
  citationsIn,
  measurementsIn,
  measurementsOfRule,
  normaliseMeasurement,
  sentencesOf,
  withoutCitations,
} from "./sentences";
import { REVIEWED_RULES, ruleOf } from "./fixtures/rules";
import { fixtureRetrieval } from "./fixtures/search";
import { retrieveRules } from "./retrieve";
import type { AskSentence, RetrievedRule } from "./types";

/**
 * The grader on its own (decision 0083). Each of its four readings is shown to catch what it is for, and shown
 * not to catch an answer that restates a rule properly. It is the only thing standing between a model and a
 * founder's tech pack, so it is tested on the rulebook's own hardest sentences rather than on tidy fixtures.
 */

const retrieve = (question: string) => retrieveRules(fixtureRetrieval(REVIEWED_RULES), question, {}, "member");

const rule = (ruleId: string): RetrievedRule => {
  const entry = ruleOf(REVIEWED_RULES, ruleId);
  return {
    ruleId: entry.ruleId,
    version: entry.version,
    title: entry.title,
    rule: entry.rule,
    body: entry.body,
    bestPractice: entry.bestPractice,
    scope: "the sublimation method",
    newerDraft: null,
    hit: { ruleId, rank: 1, matched: 2, asked: 3 },
  };
};

const said = (...texts: string[]): AskSentence[] =>
  texts.map((text) => ({ text, ruleIds: citationsIn(text) }));

describe("reading an answer as sentences", () => {
  it("splits on sentence ends and leaves numbers, ids and stitch classes whole", () => {
    expect(sentencesOf("Panels shift by 3 mm (R-SUB-004). Keep crests 15 mm away (R-SUB-004).")).toEqual([
      "Panels shift by 3 mm (R-SUB-004).",
      "Keep crests 15 mm away (R-SUB-004).",
    ]);
    expect(sentencesOf("Shrink is 1.5% in length (R-SUB-006).")).toHaveLength(1);
    expect(sentencesOf("2-needle coverstitch, ISO 406.504, 6.4 mm gauge (R-CON-007).")).toHaveLength(1);
  });

  it("finds the ids a sentence cites, each once, and leaves nothing of them behind for the number reading", () => {
    expect(citationsIn("Both (R-SUB-004) and (R-CON-003) say so, as does R-SUB-004.")).toEqual(["R-SUB-004", "R-CON-003"]);
    expect(citationsIn("Nothing here.")).toEqual([]);
    expect(withoutCitations("Keep 15 mm clear (R-SUB-004).")).not.toMatch(/004/);
  });
});

describe("reading an answer for measurements", () => {
  it("reads a number with a unit, and nothing else", () => {
    expect(measurementsIn("Allow 6 mm, hem 25 mm, shrink 1.5%, print at 150 DPI.")).toEqual(["6mm", "25mm", "1.5%", "150dpi"]);
    expect(measurementsIn("One continuous seam, 4-thread overlock, ISO 514.")).toEqual([]);
    expect(measurementsIn("12-14 stitches per inch")).toEqual([]);
  });

  it("counts both ends of a range the rule writes once", () => {
    expect(measurementsOfRule("Only white polyester-rich fabric (85-100% polyester) is sublimated")).toEqual(["100%", "85%"]);
    expect(measurementsOfRule("Total cap length is 0-6 mm longer than the armhole")).toEqual(["6mm", "0mm"]);
  });

  it("reads the same number written two ways as one measurement", () => {
    expect(normaliseMeasurement("1.0", "%")).toBe(normaliseMeasurement("1", "%"));
    expect(measurementsIn("1.5 % and 1.5%")).toEqual(["1.5%"]);
  });

  it("knows what each retrieved rule states", () => {
    const lookup = lookupOf([rule("R-SUB-004")]);
    expect(lookup.ids.has("R-SUB-004")).toBe(true);
    expect([...(lookup.measurements["R-SUB-004"] ?? [])].sort()).toEqual(["15mm", "3mm"]);
  });
});

describe("an answer that restates the rulebook", () => {
  it("passes when every sentence cites a rule the search found", async () => {
    const rules = await retrieve("How far from a seam should a crest sit?");
    const grade = gradeAnswer(
      said(
        "Artwork that crosses a seam can be offset by up to 3 mm after sewing (R-SUB-004).",
        "Critical elements keep 15 mm away from seams (R-SUB-004).",
      ),
      rules,
    );
    expect(grade.ok).toBe(true);
    expect(grade.defects).toEqual([]);
    expect(grade.cited).toEqual(["R-SUB-004"]);
  });

  it("passes the fixed not-covered words, which cite nothing because there is nothing to cite", () => {
    const grade = gradeAnswer([{ text: NOT_COVERED, ruleIds: [] }], []);
    expect(grade.ok).toBe(true);
    expect(grade.cited).toEqual([]);
  });
});

describe("the four readings, each catching what it is for", () => {
  const rules = [rule("R-SUB-004"), rule("R-CON-003")];

  it("turns down a sentence that names no rule, however true it sounds", () => {
    const grade = gradeAnswer(said("Panels shift by 3 mm (R-SUB-004).", "Flatlock seams never chafe."), rules);
    expect(grade.ok).toBe(false);
    expect(grade.defects.map((defect) => defect.kind)).toEqual(["uncited_sentence"]);
    expect(grade.defects[0].sentence).toBe("Flatlock seams never chafe.");
  });

  it("turns down an id the search did not return, whether it is a real rule or invented", () => {
    const grade = gradeAnswer(said("The rib is cut shorter than the neckline (R-PAT-008)."), rules);
    expect(grade.defects.map((defect) => defect.kind)).toEqual(["id_not_retrieved"]);
    expect(gradeAnswer(said("A made-up rule says so (R-ZZZ-999)."), rules).ok).toBe(false);
  });

  it("turns down a measurement none of the cited rules states", () => {
    const grade = gradeAnswer(said("Keep artwork 42 mm away from every seam (R-SUB-004)."), rules);
    expect(grade.defects.map((defect) => defect.kind)).toEqual(["measurement_not_in_the_rule"]);
    expect(grade.defects[0].detail).toContain("42mm");
  });

  it("turns down an answer whose recorded ids are not the ones its words cite", () => {
    const text = "Panels shift by 3 mm (R-SUB-004).";
    expect(gradeAnswer([{ text, ruleIds: [] }], rules).defects.map((defect) => defect.kind)).toEqual(["citation_mismatch"]);
    expect(gradeAnswer([{ text, ruleIds: ["R-SUB-004", "R-CON-003"] }], rules).ok).toBe(false);
  });

  it("says plainly what it found when a sentence cites nothing and records nothing", () => {
    const grade = gradeAnswer([{ text: "Seams are soft.", ruleIds: [] }], rules);
    expect(grade.defects.map((defect) => defect.kind)).toEqual(["uncited_sentence"]);
    expect(gradeAnswer([{ text: "Seams are soft.", ruleIds: ["R-SUB-004"] }], rules).defects[0].detail).toContain("records R-SUB-004");
    expect(gradeAnswer([{ text: "A 42 mm gap.", ruleIds: [] }], rules).defects.map((defect) => defect.detail).join(" ")).toContain(
      "any cited rule",
    );
  });

  it("knows a rule with no measurement in it states none", () => {
    expect(lookupOf([{ ...rule("R-CON-003"), rule: "One continuous seam", body: "", bestPractice: "", title: "" }]).measurements["R-CON-003"]?.size).toBe(0);
  });

  it("turns down an answer with no sentence in it at all", () => {
    expect(gradeAnswer([], rules).defects.map((defect) => defect.kind)).toEqual(["no_sentences"]);
  });

  it("reads every sentence of a part, not only the one that happens to carry the id", () => {
    const grade = gradeAnswer(
      [{ text: "Panels shift by 3 mm (R-SUB-004). Anything can cross a seam safely.", ruleIds: ["R-SUB-004"] }],
      rules,
    );
    expect(grade.ok).toBe(false);
    expect(grade.defects.map((defect) => defect.kind)).toContain("uncited_sentence");
  });

  it("lets a measurement through only on the rule that states it", () => {
    expect(gradeAnswer(said("One continuous overlock seam, offset up to 3 mm (R-CON-003)."), rules).ok).toBe(true);
    expect(gradeAnswer(said("A 25 mm hem (R-CON-003)."), rules).ok).toBe(false);
  });
});
