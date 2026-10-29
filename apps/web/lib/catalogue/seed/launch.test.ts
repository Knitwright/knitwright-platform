import { describe, expect, it } from "vitest";
import { catalogue, readOnboarding } from "../fixtures/source";
import { DRAFT_LABEL } from "../vocabulary";
import { DRAFT_ARTICLES } from "./launch";

/** The rows of ONBOARDING.md's launch table: wave, when, code, article, class, serves. */
const onboardingRows = (): { code: string; name: string; productionClass: string; serves: string }[] =>
  [...readOnboarding().matchAll(/^\| \d \| [^|]+ \| `([A-Z0-9-]+)` \| ([^|]+) \| ([AB]) \| ([^|]+) \|$/gm)].map((match) => ({
    code: match[1]!,
    name: match[2]!.trim(),
    productionClass: match[3]!,
    serves: match[4]!.trim(),
  }));

const servesOf = (uses: readonly string[]): string =>
  uses.map((use) => use.charAt(0).toUpperCase() + use.slice(1)).join(" + ");

describe("the launch catalogue", () => {
  const all = catalogue();

  it("is the eight articles of ONBOARDING.md, in its order, with their class and front doors", () => {
    const rows = onboardingRows();
    expect(rows).toHaveLength(8);
    expect(all.map((a) => a.code)).toEqual(rows.map((row) => row.code));
    expect(all.map((a) => a.productionClass)).toEqual(rows.map((row) => row.productionClass));
    expect(all.map((a) => servesOf(a.uses))).toEqual(rows.map((row) => row.serves));
  });

  it("names the seven drafts as ONBOARDING.md does", () => {
    const names = new Map(onboardingRows().map((row) => [row.code, row.name]));
    for (const draft of DRAFT_ARTICLES) expect(draft.name).toBe(names.get(draft.code));
  });

  it("labels every article as Knitwright's draft, not reviewed by a factory", () => {
    expect(all.every((a) => a.dataLabel === DRAFT_LABEL && a.status === "draft")).toBe(true);
  });

  it("gives the seven drafts fabric codes but no sizes, measures, ranges, options or construction", () => {
    for (const draft of DRAFT_ARTICLES) {
      expect(draft.fabrics.length).toBeGreaterThan(0);
      expect(draft.fabrics.every((fabric) => fabric.role === null && fabric.gsm === null)).toBe(true);
      expect([draft.sizeRange, draft.poms, draft.parameters, draft.options, draft.construction]).toEqual([[], [], [], [], []]);
      expect([draft.sampleSize, draft.fit, draft.seamAllowances, draft.thread, draft.hsCode]).toEqual([null, null, null, null, null]);
    }
  });

  it("uses the fabric programme codes of the launch catalogue in 01-product-direction.md", () => {
    expect(Object.fromEntries(DRAFT_ARTICLES.map((a) => [a.code, a.fabrics.map((f) => f.code)]))).toEqual({
      "SHO-TR-01": ["F-POLY-INT"],
      "JSY-LS-01": ["F-POLY-INT"],
      "CRK-SS-01": ["F-POLY-PQ"],
      "TEE-TR-01": ["F-STK-TEE"],
      "HOD-ST-01": ["F-STK-FLC"],
      "CMP-LS-01": ["F-POLY-EL"],
      "FSH-MM-01": ["F-POLY-4W"],
    });
  });

  it("has an article type that is the first part of each code", () => {
    for (const a of all) expect(a.code.startsWith(`${a.articleType}-`)).toBe(true);
  });
});
