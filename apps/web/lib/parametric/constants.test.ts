import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUNDLED_ARTICLES,
  constantGroups,
  draftArticle,
  draftConstantsSchema,
  draftConstantsSource,
  labelOf,
  ruleOf,
  SEEDED_DRAFT_CONSTANTS,
  type ArticleDefinition,
  type DraftConstants,
} from "./index";

/**
 * Owner decision 7: every drafting number is data. These tests prove the three halves of that:
 * the seeded constants are labelled, the drafter really reads them, and the drafting layer holds
 * no number of its own.
 */

const JSY = BUNDLED_ARTICLES.get("JSY-SS-01") as ArticleDefinition;
const CONSTANTS = SEEDED_DRAFT_CONSTANTS.get("JSY-SS-01") as DraftConstants;
const sources = (constants: DraftConstants) => ({ constants: draftConstantsSource({ "JSY-SS-01": constants }) });

/** The same constants with one value replaced. */
function withEase(ease: number): DraftConstants {
  const values = { ...CONSTANTS.values, curves: { ...CONSTANTS.values.curves, sleeve_cap: { ...CONSTANTS.values.curves.sleeve_cap, ease_mm: ease } } };
  return draftConstantsSchema.parse({ labels: CONSTANTS.labels, values });
}

const lengthOf = (size: string, label: string, constants: DraftConstants): number => {
  const outcome = draftArticle("JSY-SS-01", size, {}, sources(constants));
  if (outcome.kind !== "drafted") throw new Error(`${outcome.kind}: ${JSON.stringify(outcome)}`);
  return outcome.draft.lengths.find((l) => l.label === label)?.mm ?? Number.NaN;
};

describe("the seeded drafting constants", () => {
  it("labels every group of numbers with a rulebook entry, a source and who has reviewed it", () => {
    expect(CONSTANTS.labels.map((l) => l.key).sort()).toEqual(constantGroups(CONSTANTS.values).sort());
    for (const label of CONSTANTS.labels) {
      expect(label.rule).toMatch(/^R-[A-Z]+-\d{3}$/);
      expect(label.label).toBe("Knitwright draft v0.1, not reviewed by a factory");
      expect(label.source.length).toBeGreaterThan(0);
    }
  });

  it("refuses a group of numbers that no label covers", () => {
    const unlabelled = { labels: CONSTANTS.labels.filter((l) => l.key !== "notches.neck_rib"), values: CONSTANTS.values };
    expect(() => draftConstantsSchema.parse(unlabelled)).toThrow(/No label for the draft constants notches.neck_rib/);
  });

  it("finds a group's label and rule, and says so when there is none", () => {
    expect(labelOf(CONSTANTS, "curves.sleeve_cap")?.rule).toBe("R-PAT-007");
    expect(ruleOf(CONSTANTS, "drop_tail.convention")).toBe("R-PAT-005");
    expect(labelOf(CONSTANTS, "curves.collar")).toBeNull();
    expect(ruleOf(CONSTANTS, "curves.collar")).toBeNull();
  });

  it("is the drafter's only source: an article with no constants on file is not drafted yet", () => {
    const outcome = draftArticle("JSY-SS-01", "M", {}, { constants: draftConstantsSource({}) });
    expect(outcome).toMatchObject({ kind: "not-drafted-yet", ruleId: null });
    expect(outcome.kind === "not-drafted-yet" && outcome.reason).toContain("no drafting constants on file");
  });
});

describe("the sleeve-cap ease, now a constant", () => {
  it("is the script's 3 mm, and the pattern is built to whatever the constant says", () => {
    expect(CONSTANTS.values.curves.sleeve_cap.ease_mm).toBe(3);
    expect(lengthOf("M", "Total ease, cap vs armhole", CONSTANTS)).toBeCloseTo(3, 9);
    expect(lengthOf("M", "Total ease, cap vs armhole", withEase(6))).toBeCloseTo(6, 9);
    expect(lengthOf("M", "Sleeve cap height", withEase(6))).toBeGreaterThan(lengthOf("M", "Sleeve cap height", CONSTANTS));
  });

  it("has to sit inside the 0 to 6 mm window the article allows, or nothing is drafted", () => {
    expect(JSY.draft_constants.sleeve_cap_ease_target).toEqual([0, 6]);
    for (const ease of [-1, 7]) {
      const outcome = draftArticle("JSY-SS-01", "M", {}, sources(withEase(ease)));
      expect(outcome).toMatchObject({ kind: "not-drafted-yet", ruleId: "R-PAT-007" });
      expect(outcome.kind === "not-drafted-yet" && outcome.reason).toContain("outside the 0 to 6 mm");
    }
    for (const ease of [0, 6]) expect(draftArticle("JSY-SS-01", "M", {}, sources(withEase(ease))).kind).toBe("drafted");
  });
});

/**
 * Comments, strings and template literals are taken out, then every number left in the drafting
 * layer is read. Only 0, 1 and 2 may stay: they are array indexes, a piece count and the halving
 * or doubling of a half measurement, not measurements of the garment.
 */
const STRUCTURAL = new Set(["0", "1", "2"]);

function numbersIn(code: string): string[] {
  const bare = code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
  return [...bare.matchAll(/(?<![\w.$])\d+(?:\.\d+)?(?:e-?\d+)?/g)].map((m) => m[0]);
}

describe("no drafting literal is left in TypeScript", () => {
  const dir = join(__dirname, "jsy-ss-01");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("reads every file of the drafting layer", () => {
    expect(files.sort()).toEqual(["checks.ts", "curves.ts", "drop-tail.ts", "index.ts", "pieces.ts"]);
  });

  it.each(files)("%s holds no number but an index, a count or a half", (file) => {
    expect(numbersIn(readFileSync(join(dir, file), "utf8")).filter((n) => !STRUCTURAL.has(n))).toEqual([]);
  });

  it("would catch a number put back", () => {
    expect(numbersIn("const ease = 3; // 4\nconst s = 'a 5';")).toEqual(["3"]);
    expect(numbersIn("const x = k.control_1_inset_mm - p[0];")).toEqual(["0"]);
  });
});
