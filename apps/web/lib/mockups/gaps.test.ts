import { describe, expect, it } from "vitest";
import { gapForArticle } from "@/lib/templates/kinds/gaps";
import { CONTEXT_ARTICLE_GAP, MODEL_PRESET_GAP, SERVER_RENDER_GAP, TURNTABLE_CLIP_GAP, allMockupGaps, fromArticle, hasSceneGap, sceneCounts, sceneGaps } from "./gaps";
import { ALL_MOCKUP_SCENES, sceneBySlug } from "./scenes";

/**
 * Every gap the mockup studio carries, and the rule that explains each one. No rulebook entry covers
 * the launch canvas or the mockup studio, so every one of them is `R-GAP-000` and the pull request
 * lists them; this test is what keeps the list and the code the same list.
 */

describe("the gaps this workstream carries", () => {
  it("gives every one of them R-GAP-000, because no rulebook entry covers the mockup studio", () => {
    expect(allMockupGaps().length).toBeGreaterThanOrEqual(7);
    for (const gap of allMockupGaps()) expect(gap.ruleId, gap.line).toBe("R-GAP-000");
  });

  it("names each of the five the spec left open", () => {
    const lines = allMockupGaps().map((gap) => gap.line);
    expect(lines).toContain(MODEL_PRESET_GAP.line);
    expect(lines).toContain(SERVER_RENDER_GAP.line);
    expect(lines).toContain(TURNTABLE_CLIP_GAP.line);
    expect(lines).toContain(CONTEXT_ARTICLE_GAP.line);
    expect(lines.some((line) => line.includes("asks for 40 mockup scenes"))).toBe(true);
    expect(lines.some((line) => line.includes("article filter"))).toBe(true);
  });
});

describe("the gaps of one scene", () => {
  it("says nothing about a scene drawn straight from the front", () => {
    expect(sceneGaps(sceneBySlug("product-front")!)).toEqual([]);
    expect(hasSceneGap(sceneBySlug("product-front")!)).toBe(false);
  });

  it("says a turned view is a turned drawing, once per view however many slots use it", () => {
    const gaps = sceneGaps(sceneBySlug("product-three-quarter")!);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.line).toContain("turned 45°");
    expect(sceneGaps(sceneBySlug("team-line-up-eleven")!).some((gap) => gap.line.includes("turned 45°"))).toBe(true);
  });

  it("says a scene a model runs has no model preset yet", () => {
    expect(sceneGaps(sceneBySlug("dojo-mat")!)).toEqual([MODEL_PRESET_GAP]);
    expect(hasSceneGap(sceneBySlug("dojo-mat")!)).toBe(true);
  });

  it("carries the article's own gap in the article's own words, and never writes one of its own", () => {
    const article = gapForArticle("TEE-TR-01");
    expect(article).not.toBeNull();
    const shown = fromArticle(article!);
    expect(shown.ruleId).toBe(article!.ruleId);
    expect(shown.line).toContain(article!.line);
    expect(sceneGaps(sceneBySlug("product-front")!, article!)).toEqual([shown]);
    expect(hasSceneGap(sceneBySlug("product-front")!, article!)).toBe(true);
  });

  it("has no gap to report for the one launch article with a factory-shaped brief", () => {
    expect(gapForArticle("JSY-SS-01")).toBeNull();
  });
});

describe("how many scenes work now", () => {
  it("counts the whole library, the half this workstream draws and the half marked for L3", () => {
    const counts = sceneCounts();
    expect(counts.total).toBe(ALL_MOCKUP_SCENES.length);
    expect(counts.deterministic + counts.ai).toBe(counts.total);
    expect(counts.deterministic).toBeGreaterThan(0);
    expect(counts.ai).toBeGreaterThan(0);
    expect(sceneCounts([])).toEqual({ total: 0, deterministic: 0, ai: 0 });
  });
});
