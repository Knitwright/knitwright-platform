import type { RateLimitRule } from "@/lib/server/core/guard";

/**
 * The rate limits of benchmarks. The first two are applied by `defineAction` per address and per person, as every
 * other action's are. The last two are counted inside the action with the same limiter (lib/server/rate-limit.ts),
 * keyed by brand and by brand-and-site, because the spec limits the fetching **per brand**, not per person: ten people
 * in one brand must not be able to read a hundred of a competitor's pages between them.
 *
 * The numbers are Knitwright drafts and an owner question, chosen to be polite rather than tuned.
 */
const MINUTE = 60;
const HOUR = 60 * MINUTE;

export const BENCHMARK_LIMITS = {
  /** Making a benchmark, confirming a card, deleting one. */
  write: { name: "benchmark-write", limit: 60, windowSeconds: 10 * MINUTE },
  /** Adding a card: a fetch and an AI call. */
  intake: { name: "benchmark-intake", limit: 20, windowSeconds: 10 * MINUTE },
  /** Pages one brand may fetch in an hour, whoever asks. */
  brandFetch: { name: "benchmark-fetch-brand", limit: 20, windowSeconds: HOUR },
  /** Pages one brand may fetch from one site in an hour. */
  hostFetch: { name: "benchmark-fetch-host", limit: 5, windowSeconds: HOUR },
} as const satisfies Record<string, RateLimitRule>;

export const brandFetchKey = (brandId: string): string => `${BENCHMARK_LIMITS.brandFetch.name}:brand:${brandId}`;
export const hostFetchKey = (brandId: string, host: string): string => `${BENCHMARK_LIMITS.hostFetch.name}:brand:${brandId}:host:${host.toLowerCase()}`;

export const TOO_MANY_FETCHES = "This brand has read as many competitor pages as it may for now. Try again later, or upload a photo instead.";
