import type { RateLimitRule } from "@/lib/server/core/guard";

/**
 * The per-brand fetch limits of benchmarks. `defineAction` already counts every call per address and per person
 * (`LIMITS.benchmarkWrite` and `LIMITS.benchmarkIntake`). These two are counted inside the action with the same
 * limiter (lib/server/rate-limit.ts), keyed by brand and by brand-and-site, because the spec limits the fetching
 * **per brand**, not per person: ten people in one brand must not be able to read a hundred of a competitor's pages
 * between them.
 *
 * The numbers are Knitwright drafts and an owner question, chosen to be polite rather than tuned.
 */
const MINUTE = 60;
const HOUR = 60 * MINUTE;

export const BENCHMARK_LIMITS = {
  /** Pages one brand may fetch in an hour, whoever asks. */
  brandFetch: { name: "benchmark-fetch-brand", limit: 20, windowSeconds: HOUR },
  /** Pages one brand may fetch from one site in an hour. */
  hostFetch: { name: "benchmark-fetch-host", limit: 5, windowSeconds: HOUR },
} as const satisfies Record<string, RateLimitRule>;

export const brandFetchKey = (brandId: string): string => `${BENCHMARK_LIMITS.brandFetch.name}:brand:${brandId}`;
export const hostFetchKey = (brandId: string, host: string): string => `${BENCHMARK_LIMITS.hostFetch.name}:brand:${brandId}:host:${host.toLowerCase()}`;

export const TOO_MANY_FETCHES = "This brand has read as many competitor pages as it may for now. Try again later, or upload a photo instead.";
