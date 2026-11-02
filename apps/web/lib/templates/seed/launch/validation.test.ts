import { describe, expect, it } from "vitest";
import { baseArticleForType } from "@/lib/catalogue";
import { catalogue } from "@/lib/catalogue/fixtures/source";
import { RULE_ID_PATTERN } from "@/lib/validation/rules";
import { UNWIRED_MODERATION, type ArticleCatalogue } from "@/lib/validation/ports";
import { toValidationParameter } from "@/lib/validation/live-ports";
import { specInput, standardRegistry } from "@/lib/validation/spec-input";
import { defaultFactoryProfile } from "@/lib/validation/profile";
import { validateDesign, type ValidationResult } from "@/lib/validation/validate";
import type { DesignInput } from "@/lib/validation/registry";
import { everySeedTemplate } from "../seed";
import type { SeedTemplate } from "../build";

/**
 * The acceptance test of plan v5 L8: **every design template passes X4 validation** (F-0). A template
 * that cannot be made is worse than a template that is missing, so this runs the real gate — the five
 * guardrails, parameters in range and moderation clear — over all 60 starters, against the default
 * factory profile and the committed launch catalogue.
 *
 * The catalogue port is built from the articles the spec commits (`lib/catalogue/fixtures/source.ts`),
 * so a starter's structure is held to the article's own approved parameters, not to an empty stand-in.
 * No database and no paid call is involved.
 */

const articles = new Map(catalogue().map((article) => [article.code, article]));

const fixtureCatalogue: ArticleCatalogue = {
  articleForType: async (typeId) => {
    const code = baseArticleForType(typeId);
    const article = code === undefined ? undefined : articles.get(code);
    return article === undefined ? null : { baseArticleCode: article.code, productionClass: article.productionClass };
  },
  parameterDefs: async (code) => {
    const article = articles.get(code);
    return article === undefined ? null : article.parameters.flatMap((def) => toValidationParameter(def) ?? []);
  },
};

const inputFor = async (seed: SeedTemplate): Promise<DesignInput> => ({
  typeId: seed.snapshot.typeId,
  readiness: null,
  ...(await specInput(seed.snapshot, "11111111-1111-4111-8111-111111111111", { catalogue: fixtureCatalogue, moderation: UNWIRED_MODERATION })),
});

const validate = async (seed: SeedTemplate): Promise<ValidationResult> =>
  validateDesign(await inputFor(seed), defaultFactoryProfile(), standardRegistry());

const seeds = everySeedTemplate();

describe("every design template passes validation", () => {
  it.each(seeds.map((seed) => [seed.slug, seed] as const))("%s has no blocker", async (_slug, seed) => {
    const result = await validate(seed);

    expect(result.findings.filter((found) => found.severity === "blocker")).toEqual([]);
    expect(result.blockers).toBe(0);
    expect(result.orderable).toBe(true);
  });

  it("gives every check of every starter a rule id", async () => {
    for (const seed of seeds) {
      const { checks } = await validate(seed);
      expect(checks.length, seed.slug).toBeGreaterThan(0);
      for (const check of checks) expect(check.ruleId, `${seed.slug}: ${check.code}`).toMatch(RULE_ID_PATTERN);
    }
  });

  it("holds the starters on JSY-SS-01 to that article's own approved parameters", async () => {
    const jersey = seeds.find((seed) => seed.articleId === "team-jersey")!;
    const input = await inputFor(jersey);

    expect(input.article).toEqual({ baseArticleCode: "JSY-SS-01", productionClass: "A", parameters: {} });
    expect(input.parameterDefs!.length).toBeGreaterThan(0);
  });

  it("is told that a garment the catalogue maps to no article sits on none, and is not blocked by it", async () => {
    // The polo is a registry type with no base article (decision 0066), and that is a warning, never a blocker.
    const polo = seeds.find((seed) => seed.articleId === "polo")!;
    const result = await validate(polo);

    expect(result.findings.map((found) => found.code)).toContain("article-not-set");
    expect(result.blockers).toBe(0);
  });
});
