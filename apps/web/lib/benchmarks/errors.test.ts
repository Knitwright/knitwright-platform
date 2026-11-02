import { describe, expect, it } from "vitest";
import { benchmarkFailure } from "./errors";
import { BENCHMARK_LIMITS, brandFetchKey, hostFetchKey } from "./limits";
import { BENCHMARK_RULE_GAPS, BENCHMARK_USER_AGENT, FEATURE_KEYS, FEATURES, featureOf, RULE_GAP } from "./vocabulary";

describe("benchmarkFailure", () => {
  it("turns the database's hints into words a person can act on", () => {
    expect(benchmarkFailure({ message: "x", hint: "too_many_cards" })).toMatchObject({ code: "conflict" });
    expect(benchmarkFailure({ message: "x", hint: "already_confirmed" }).message).toContain("already been confirmed");
    const limited = benchmarkFailure({ message: "x", hint: "rate_limited" });
    expect(limited.code).toBe("rate_limited");
    expect(limited.message).toContain("as many competitor pages");
  });

  it("answers for another brand's row the way it answers for one that is not there", () => {
    expect(benchmarkFailure({ message: "x", code: "P0002" })).toMatchObject({ code: "not_found" });
    expect(benchmarkFailure({ message: "x", code: "42501" })).toMatchObject({ code: "forbidden" });
  });

  it("takes a refused shape as bad input and anything else as ours to fix", () => {
    for (const code of ["22023", "23505", "23514"]) expect(benchmarkFailure({ message: "x", code }), code).toMatchObject({ code: "invalid_input" });
    expect(benchmarkFailure({ message: "down" })).toMatchObject({ code: "internal" });
  });
});

describe("the per-brand fetch limits", () => {
  it("counts a brand's pages, and a brand's pages from one site, under keys of their own", () => {
    expect(brandFetchKey("brand-1")).toBe("benchmark-fetch-brand:brand:brand-1");
    expect(hostFetchKey("brand-1", "Shop.Example.TEST")).toBe("benchmark-fetch-host:brand:brand-1:host:shop.example.test");
  });

  it("holds one site tighter than the whole web, so no one site is hammered", () => {
    expect(BENCHMARK_LIMITS.hostFetch.limit).toBeLessThan(BENCHMARK_LIMITS.brandFetch.limit);
    for (const rule of Object.values(BENCHMARK_LIMITS)) {
      expect(Number.isInteger(rule.limit) && rule.limit > 0, rule.name).toBe(true);
      expect(Number.isInteger(rule.windowSeconds) && rule.windowSeconds > 0, rule.name).toBe(true);
    }
  });
});

describe("the taxonomy", () => {
  it("names each feature once, with words for what it does", () => {
    expect(new Set(FEATURE_KEYS).size).toBe(FEATURES.length);
    expect(FEATURES.every((feature) => feature.label !== "" && feature.purpose !== "")).toBe(true);
  });

  it("finds a feature by key, and nothing for a key it does not know", () => {
    expect(featureOf("drop_tail")?.label).toBe("Drop tail");
    expect(featureOf("not_a_feature")).toBeUndefined();
  });

  it("marks a logo, a brand name and a print as graphic, so nothing carries them over", () => {
    for (const key of ["brand_logo", "brand_name", "all_over_print"]) expect(featureOf(key)?.kind, key).toBe("graphic");
  });

  it("sends the user agent the spec names, with an address a site owner can read", () => {
    expect(BENCHMARK_USER_AGENT).toBe("KnitwrightBenchmark/1.0 (+https://knitwright.com/bot)");
  });

  it("lists the gaps this workstream opens, each under the gap id", () => {
    expect(BENCHMARK_RULE_GAPS.length).toBeGreaterThan(0);
    expect(BENCHMARK_RULE_GAPS.every((gap) => gap.startsWith(RULE_GAP))).toBe(true);
  });
});
