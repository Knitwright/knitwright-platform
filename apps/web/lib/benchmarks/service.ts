import type { ModelImage } from "@/lib/providers/text-model";
import type { RateLimitRule } from "@/lib/server/core/guard";
import type { BenchmarkExtractor } from "./extract";
import { fetchProductPage, normaliseUrl, urlKey, REFUSALS, type Fetcher } from "./fetch";
import { BENCHMARK_LIMITS, brandFetchKey, hostFetchKey, TOO_MANY_FETCHES } from "./limits";
import { withoutCopies } from "./normalise";
import type { BenchmarkCard } from "./schema";
import type { BenchmarkStore, Who } from "./store";

/**
 * Taking a benchmark in (spec F-S2 steps 1 to 4). One URL is fetched once, per brand, within the brand's rate limit,
 * and only if robots.txt allows it; the words of the page go to the extractor and nowhere else; the card is what is
 * stored. A photo is the person's own upload and is never fetched from anybody. Pasted review text becomes short
 * paraphrases and is never kept.
 */

export type Limiter = (key: string, rule: RateLimitRule) => Promise<boolean>;

export type ServiceDeps = Readonly<{
  store: BenchmarkStore;
  extractor: BenchmarkExtractor;
  fetcher: Fetcher;
  limiter: Limiter;
  now?: () => Date;
}>;

export type IntakeResult =
  | Readonly<{ ok: true; cardId: string }>
  | Readonly<{ ok: false; reason: "bad_url" | "private_host" | "robots" | "not_a_page" | "too_large" | "unreachable" | "already_read" | "rate_limited"; message: string }>;

export const ALREADY_READ = "That page has already been read for this brand. Its card is in your benchmarks.";
/** The most pasted review text we read. Longer is cut; none of it is stored either way. */
export const MAX_REVIEW_CHARS = 20_000;

const no = (reason: Extract<IntakeResult, { ok: false }>["reason"], message: string): IntakeResult => ({ ok: false, reason, message });

/** Both counts, through the existing limiter: this brand's pages in the hour, and this brand's pages from this site. */
async function withinLimits(limiter: Limiter, who: Who, host: string): Promise<boolean> {
  const brand = await limiter(brandFetchKey(who.brandId), BENCHMARK_LIMITS.brandFetch);
  if (!brand) return false;
  return limiter(hostFetchKey(who.brandId, host), BENCHMARK_LIMITS.hostFetch);
}

export async function addCardFromUrl(deps: ServiceDeps, who: Who, input: Readonly<{ benchmarkId: string; url: string }>): Promise<IntakeResult> {
  const url = normaliseUrl(input.url);
  if (url === null) return no("bad_url", REFUSALS.bad_url);
  if (!(await withinLimits(deps.limiter, who, url.host))) return no("rate_limited", TOO_MANY_FETCHES);
  const key = urlKey(url.toString());
  if ((await deps.store.claimFetch(who, { urlKey: key, host: url.host })) === "already") return no("already_read", ALREADY_READ);
  const outcome = await fetchProductPage(deps.fetcher, url.toString(), deps.now);
  if (!outcome.ok) {
    await deps.store.settleFetch(who, { urlKey: key, outcome: outcome.reason === "robots" ? "robots_refused" : "failed" });
    return no(outcome.reason, outcome.message);
  }
  const card = withoutCopies(await deps.extractor.extract({ kind: "url", words: outcome.page.words, title: outcome.page.title }), outcome.page.words);
  await deps.store.settleFetch(who, { urlKey: key, outcome: "fetched" });
  const cardId = await deps.store.addCard(who, {
    benchmarkId: input.benchmarkId,
    sourceKind: "url",
    sourceUrl: outcome.page.url,
    sourceHost: outcome.page.host,
    sourceFileId: null,
    card,
    extractor: deps.extractor.name,
  });
  return { ok: true, cardId };
}

/** The person's own photograph of a product, already uploaded to their brand's files and kept private. */
export async function addCardFromPhoto(
  deps: ServiceDeps,
  who: Who,
  input: Readonly<{ benchmarkId: string; fileId: string; image: ModelImage }>,
): Promise<IntakeResult> {
  const card = await deps.extractor.extract({ kind: "photo", image: input.image });
  const cardId = await deps.store.addCard(who, {
    benchmarkId: input.benchmarkId,
    sourceKind: "photo",
    sourceUrl: null,
    sourceHost: null,
    sourceFileId: input.fileId,
    card,
    extractor: deps.extractor.name,
  });
  return { ok: true, cardId };
}

/** Review text a person pasted. The words go to the extractor; only the themes are kept, and only as paraphrases. */
export async function addCardFromReviewText(
  deps: ServiceDeps,
  who: Who,
  input: Readonly<{ benchmarkId: string; text: string }>,
): Promise<IntakeResult> {
  const words = input.text.slice(0, MAX_REVIEW_CHARS);
  const card = withoutCopies(await deps.extractor.extract({ kind: "review_text", words }), words);
  const cardId = await deps.store.addCard(who, {
    benchmarkId: input.benchmarkId,
    sourceKind: "review_text",
    sourceUrl: null,
    sourceHost: null,
    sourceFileId: null,
    card,
    extractor: deps.extractor.name,
  });
  return { ok: true, cardId };
}

/** The fields a person may confirm or correct one at a time (spec F-S2 step 4). */
const CORRECTABLE = ["productName", "brandName", "price", "gsm", "fabricComposition", "fit", "sizeRange"] as const;

/**
 * A person's confirmation or correction of a card. A field whose value they changed is marked `corrected`, so the
 * screen says the words came from their team rather than from the model, and a field they left alone keeps the mark it
 * already had.
 */
export function markCorrected(before: BenchmarkCard, after: BenchmarkCard): BenchmarkCard {
  const marked: Record<string, unknown> = { ...after };
  for (const name of CORRECTABLE) {
    const was = before[name];
    const now = after[name];
    const changed = JSON.stringify(now.value) !== JSON.stringify(was.value);
    marked[name] = { ...now, corrected: changed || was.corrected || now.corrected };
  }
  return marked as BenchmarkCard;
}
