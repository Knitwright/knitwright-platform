import { describe, expect, it } from "vitest";
import {
  articleSource,
  BUNDLED_ARTICLES,
  draftAllSizes,
  draftArticle,
  GAP_RULE,
  outlineProblems,
  SEEDED_DRAFT_CONSTANTS,
  type ArticleDefinition,
  type ArticleDraft,
  type DraftConstants,
  type DraftOutcome,
} from "./index";
import { gate } from "./jsy-ss-01";

const JSY = BUNDLED_ARTICLES.get("JSY-SS-01") as ArticleDefinition;
const CONSTANTS = SEEDED_DRAFT_CONSTANTS.get("JSY-SS-01") as DraftConstants;
const SIZES = JSY.sizes;

const drafted = (outcome: DraftOutcome): ArticleDraft => {
  if (outcome.kind !== "drafted") throw new Error(`${outcome.kind}: ${JSON.stringify(outcome)}`);
  return outcome.draft;
};
const check = (draft: ArticleDraft, label: string) => draft.checks.find((c) => c.label.startsWith(label));

describe("the script registry", () => {
  it("answers 'not drafted yet' for an article without a script, such as SHO-TR-01", () => {
    const outcome = draftArticle("SHO-TR-01", "M");
    expect(outcome).toMatchObject({ kind: "not-drafted-yet", articleCode: "SHO-TR-01", ruleId: null });
    expect(draftAllSizes("SHO-TR-01").kind).toBe("not-drafted-yet");
  });

  it("answers 'not drafted yet' when the article data is not available", () => {
    expect(draftArticle("JSY-SS-01", "M", {}, { articles: articleSource([]) })).toMatchObject({ kind: "not-drafted-yet" });
    expect(draftAllSizes("JSY-SS-01", {}, { articles: articleSource([]) }).kind).toBe("not-drafted-yet");
  });

  it("answers 'not drafted yet' when the article lacks a POM the script needs, naming it", () => {
    const withoutL = { ...JSY, pom: JSY.pom.filter((p) => p.letter !== "L") };
    const outcome = draftArticle("JSY-SS-01", "M", {}, { articles: articleSource([withoutL]) });
    expect(outcome.kind).toBe("not-drafted-yet");
    expect(outcome.kind === "not-drafted-yet" && outcome.reason).toContain("POM L");
  });

  it("drafts the four pieces with the article's defaults", () => {
    const draft = drafted(draftArticle("JSY-SS-01", "M"));
    expect(draft.pieces.map((p) => p.id)).toEqual(["front", "back", "sleeve", "neck-rib"]);
    expect(draft.input).toEqual({
      parameters: { body_length_offset: 0, sleeve_length_offset: 0, back_drop_tail: 0 },
      options: { collar: "C01", sleeve_finish: "K01", pattern_fill: "P00" },
    });
    expect(draft.warnings).toEqual([]);
  });

  it("drafts every size, in the article's order", () => {
    const graded = draftAllSizes("JSY-SS-01");
    expect(graded.kind === "drafted" && graded.drafts.map((d) => d.size)).toEqual(SIZES);
  });
});

describe("options", () => {
  it.each([
    ["collar", "C02", "R-CON-005"],
    ["collar", "C03", "R-CON-006"],
  ])("%s %s is not drafted yet, with its rule", (group, code, ruleId) => {
    const outcome = draftArticle("JSY-SS-01", "M", { options: { [group]: code } });
    expect(outcome).toMatchObject({ kind: "not-drafted-yet", ruleId });
    expect(outcome.kind === "not-drafted-yet" && outcome.reason).toMatch(/^Not drafted yet: /);
  });

  it("drafts every print fill, since a fill does not change the pieces", () => {
    const plain = drafted(draftArticle("JSY-SS-01", "M"));
    for (const fill of ["P01", "P02"]) {
      expect(drafted(draftArticle("JSY-SS-01", "M", { options: { pattern_fill: fill } })).pieces).toEqual(plain.pieces);
    }
  });

  it("refuses a code or a group the article does not offer", () => {
    const outcome = draftArticle("JSY-SS-01", "M", { options: { collar: "C09", hood: "H01" } });
    expect(outcome.kind === "invalid" && outcome.findings.map((f) => f.field)).toEqual(["options.hood", "options.collar"]);
  });

  it("does not draw a new option group the script has never seen", () => {
    const withHood = { ...JSY, options: { ...JSY.options, hood: [{ code: "H01", name: "Hood", default: true }] } };
    const outcome = draftArticle("JSY-SS-01", "M", {}, { articles: articleSource([withHood]) });
    expect(outcome).toMatchObject({ kind: "not-drafted-yet", ruleId: null });
  });

  it("skips a group with no options at all", () => {
    const empty = { ...JSY, options: { ...JSY.options, trims: [] } };
    expect(drafted(draftArticle("JSY-SS-01", "M", {}, { articles: articleSource([empty]) })).input.options).not.toHaveProperty("trims");
  });
});

describe("parameters", () => {
  it("moves POM B by the body length offset on the front and back, nothing else", () => {
    const base = drafted(draftArticle("JSY-SS-01", "L"));
    const long = drafted(draftArticle("JSY-SS-01", "L", { parameters: { body_length_offset: 40 } }));
    expect(check(long, "B")).toEqual({ label: "B body length", target: 780, actual: 780 });
    expect(long.pieces[0].landmarks["cf-hem"]).toEqual([0, 780]);
    expect(long.pieces[2]).toEqual(base.pieces[2]);
    expect(long.lengths).toEqual(base.lengths);
  });

  it("moves POM D by the sleeve length offset, keeping the cap and the opening", () => {
    const base = drafted(draftArticle("JSY-SS-01", "S"));
    const short = drafted(draftArticle("JSY-SS-01", "S", { parameters: { sleeve_length_offset: -20 } }));
    expect(check(short, "D")?.actual).toBe(180);
    expect(check(short, "F")?.actual).toBe(160);
    expect(short.lengths).toEqual(base.lengths);
    expect(short.pieces[0]).toEqual(base.pieces[0]);
  });

  it("says no sample has signed off a range yet, with its rule", () => {
    const draft = drafted(draftArticle("JSY-SS-01", "M", { parameters: { body_length_offset: -30 } }));
    expect(draft.warnings).toEqual([expect.objectContaining({ ruleId: "R-PAT-003", field: "parameters.body_length_offset" })]);
    const signed = { ...JSY, parameters: JSY.parameters.map((p) => ({ ...p, approved: true })) };
    expect(drafted(draftArticle("JSY-SS-01", "M", { parameters: { body_length_offset: -30 } }, { articles: articleSource([signed]) })).warnings).toEqual([]);
  });

  it.each([
    [{ body_length_offset: 50 }, "R-PAT-003", /outside the range/],
    [{ body_length_offset: -40 }, "R-PAT-003", /outside the range/],
    [{ sleeve_length_offset: 15 }, "R-PAT-004", /between steps/],
    [{ back_drop_tail: Number.NaN }, "R-PAT-005", /must be a number/],
    [{ cuff_depth: 10 }, GAP_RULE, /no parameter cuff_depth/],
  ])("refuses %o, never clamping it", (parameters, ruleId, message) => {
    const outcome = draftArticle("JSY-SS-01", "M", { parameters });
    expect(outcome.kind).toBe("invalid");
    expect(outcome.kind === "invalid" && outcome.findings[0]).toMatchObject({ ruleId, message: expect.stringMatching(message) });
  });

  it("refuses a size the article is not graded to", () => {
    const outcome = draftArticle("JSY-SS-01", "4XL");
    expect(outcome.kind === "invalid" && outcome.findings).toEqual([expect.objectContaining({ field: "size", ruleId: GAP_RULE })]);
    expect(draftAllSizes("JSY-SS-01", { parameters: { body_length_offset: 5 } }).kind).toBe("invalid");
  });
});

describe("spec F-S3: every size at every parameter's range ends gives valid closed panels", () => {
  const bodyEnds = [-30, 0, 40];
  const sleeveEnds = [-20, 0, 40];
  const combos = bodyEnds.flatMap((b) => sleeveEnds.map((s) => ({ body_length_offset: b, sleeve_length_offset: s })));

  it.each(SIZES)("size %s", (size) => {
    for (const parameters of combos) {
      const draft = drafted(draftArticle("JSY-SS-01", size, { parameters }));
      for (const piece of draft.pieces) {
        expect({ piece: piece.id, parameters, cut: outlineProblems(piece.cutLine), sew: outlineProblems(piece.sewLine) }).toEqual({
          piece: piece.id,
          parameters,
          cut: [],
          sew: [],
        });
      }
      for (const c of draft.checks) expect(Math.abs(c.actual - c.target)).toBeLessThan(0.5);
    }
  });
});

describe("an article that offers less than the script draws", () => {
  it("drafts at the POM value when the article offers no length offset", () => {
    const noOffsets = { ...JSY, parameters: JSY.parameters.filter((p) => p.key === "back_drop_tail") };
    const draft = drafted(draftArticle("JSY-SS-01", "M", {}, { articles: articleSource([noOffsets]) }));
    expect(draft.input.parameters).toEqual({ back_drop_tail: 0 });
    expect(check(draft, "B")).toEqual({ label: "B body length", target: 720, actual: 720 });
    expect(check(draft, "D")).toEqual({ label: "D sleeve length", target: 210, actual: 210 });
  });

  it("names the code itself when an option is chosen that the article does not list", () => {
    const stop = gate(JSY, { parameters: {}, options: { collar: "C99" } }, CONSTANTS);
    expect(stop).toEqual({ reason: "JSY-SS-01 collar C99 (C99) is not drafted yet.", ruleId: null });
  });
});
