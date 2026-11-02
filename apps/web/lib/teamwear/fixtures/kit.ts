import type { BaseArticle } from "@/lib/catalogue";
import { catalogue } from "@/lib/catalogue/fixtures/source";
import { appTier } from "@/lib/factory/fixtures/rows";
import type { PriceSource } from "@/lib/home/price";
import type { ArticleBook } from "../kit";

/**
 * Fixtures for the configurator's tests. The articles are the real launch catalogue, read from the
 * build pack's own `article.json`, so a test can never pass against an invented option code. The
 * ladders are the factory test rows, whose every label says "test".
 */

export const articles = (): readonly BaseArticle[] => catalogue();

export const articleBook = (): ArticleBook => new Map(articles().map((article) => [article.code, article] as const));

/** JSY-SS-01, the only launch article with options, ranges and a factory block. */
export const jersey = (): BaseArticle => articles().find((article) => article.code === "JSY-SS-01")!;

/** SHO-TR-01, a brief with no options and no ranges yet. */
export const shorts = (): BaseArticle => articles().find((article) => article.code === "SHO-TR-01")!;

/** The jersey's test ladder: 10–19 at £29.00, 20–49 at £25.00, 50+ at £22.00, and no AUD price. */
export const JERSEY_LADDER = [appTier(10, 19, 2900), appTier(20, 49, 2500), appTier(50, null, 2200)];

/** The shorts' test ladder: one open tier at £12.00. */
export const SHORTS_LADDER = [appTier(10, null, 1200)];

/** A price book over the two ladders. An article not in it has no tiers, as an unpriced one has. */
export const testBook = (moq: number | null = 10) =>
  (code: string): PriceSource => {
    if (code === "JSY-SS-01") return { ladder: JERSEY_LADDER, moq };
    if (code === "SHO-TR-01") return { ladder: SHORTS_LADDER, moq };
    return { ladder: [], moq: null };
  };

/** A price book with nothing in it, as a failed read of the factory tables gives. */
export const emptyBook = () => (): PriceSource => ({ ladder: [], moq: null });
