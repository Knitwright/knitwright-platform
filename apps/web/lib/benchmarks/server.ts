import "server-only";
import { getEnv } from "@/lib/config/env";
import { chooseModels } from "@/lib/providers/select";
import { adminClient, productionDeps, sessionClient } from "@/lib/server/deps";
import { createRateLimiter } from "@/lib/server/rate-limit";
import { createModelExtractor, createStubExtractor, type BenchmarkExtractor } from "./extract";
import { emptyCard } from "./schema";
import { extractCostMicrodollars, meteredExtractor } from "./metered";
import { createSupabaseStore, type BenchmarkStore, type Who } from "./store";
import type { ServiceDeps } from "./service";

/**
 * Joins the benchmark screens to the database, the configured model, the usage meter and the rate limiter. Nothing in
 * this file holds a rule of its own.
 *
 * Two things it guarantees. **No paid call without a key**: with `AI_PROVIDER_STUB=on` (the browser tests) or with no
 * model key at all, the extractor is the deterministic stub and no model is reached. And **nothing is fetched by the
 * app's own fetch except through the service**: `fetcher` is the platform `fetch`, handed in, so every test supplies
 * its own and no test ever reaches the network.
 */

export const benchmarkStore = async (): Promise<BenchmarkStore> => createSupabaseStore(adminClient(), await sessionClient());

/** The stub answers with an empty card: honest about knowing nothing, rather than inventing a competitor. */
function extractorFor(who: Who, route: string): BenchmarkExtractor {
  const env = getEnv();
  const primary = env.AI_PROVIDER_STUB === "on" ? null : chooseModels(env).primary;
  if (primary === null || primary === undefined) return createStubExtractor([emptyCard()]);
  return meteredExtractor(createModelExtractor(primary.provider), productionDeps.usage, who, extractCostMicrodollars(primary.entry), route);
}

export async function benchmarkDeps(who: Who, route: string): Promise<ServiceDeps> {
  return {
    store: await benchmarkStore(),
    extractor: extractorFor(who, route),
    fetcher: (url, init) => fetch(url, init),
    limiter: createRateLimiter(adminClient()),
  };
}
