import { describe, expect, it } from "vitest";
import { CREDIT_SETTINGS } from "@/lib/credits/settings";
import { DEFAULT_SETTINGS } from "@/lib/guardrails/settings";
import { DEFAULT_OPS_SETTINGS } from "@/lib/ops/settings";
import { CORE_SETTINGS, GROUPS, SETTINGS, findSetting } from "./registry";

const valueOf = (key: string) => findSetting(key)!.fallback;

describe("the registry", () => {
  it("has unique, dotted, lower case keys the database accepts", () => {
    const keys = SETTINGS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
  });

  it("puts every setting in a known group and points it at a questionnaire question", () => {
    for (const s of SETTINGS) {
      expect(Object.keys(GROUPS), s.key).toContain(s.group);
      expect(s.question, s.key).toBeGreaterThanOrEqual(1);
      expect(s.question, s.key).toBeLessThanOrEqual(48);
    }
  });

  it("holds no secret: no key, label or help mentions one", () => {
    for (const s of SETTINGS) expect(`${s.key} ${s.label}`, s.key).not.toMatch(/secret|api.?key|password|token/i);
  });

  it("has a default that passes its own schema, unless the default is 'not set'", () => {
    for (const s of CORE_SETTINGS) {
      if (s.fallback === null) continue;
      expect(s.schema.safeParse(s.fallback).success, s.key).toBe(true);
    }
  });

  it("uses the in-code placeholders as defaults, so behaviour is unchanged until an admin sets something", () => {
    expect(valueOf("ops.cutoff_weekday")).toBe(DEFAULT_OPS_SETTINGS.cutoffWeekday);
    expect(valueOf("ops.cutoff_minutes")).toBe(DEFAULT_OPS_SETTINGS.cutoffMinutes);
    expect(valueOf("ops.lead_time_days")).toBe(DEFAULT_OPS_SETTINGS.leadTimeDays);
    expect(valueOf("guardrails.min_dpi")).toBe(DEFAULT_SETTINGS.minDpi.value);
    expect(valueOf("guardrails.bleed_mm")).toBe(DEFAULT_SETTINGS.bleedMm.value);
    expect(valueOf("guardrails.safe_zone_mm")).toBe(DEFAULT_SETTINGS.safeZoneMm.value);
    expect(valueOf("credits.monthly_allowance")).toBe(CREDIT_SETTINGS.monthlyAllowance);
    for (const kind of Object.keys(CREDIT_SETTINGS.prices) as (keyof typeof CREDIT_SETTINGS.prices)[]) {
      expect(valueOf(`credits.price_${kind}`)).toBe(CREDIT_SETTINGS.prices[kind]);
    }
  });

  it("does not invent a media cap, a lead time or a price: those start as 'not set'", () => {
    for (const key of ["media.daily_cap_per_brand", "ops.lead_time_days", "factory.lead_time_days", "factory.price_ladder"]) {
      expect(valueOf(key), key).toBeNull();
    }
  });
});

describe("every schema rejects bad values", () => {
  const bad: readonly (readonly [string, unknown])[] = [
    ["credits.price_marketing_media", -1],
    ["credits.price_techpack_pdf", 1.5],
    ["credits.price_pattern_file", "three"],
    ["credits.monthly_allowance", 1_000_001],
    ["ops.cutoff_weekday", 7],
    ["ops.cutoff_minutes", 1440],
    ["ops.lead_time_days", -2],
    ["guardrails.min_dpi", 10],
    ["guardrails.bleed_mm", 51],
    ["guardrails.safe_zone_mm", -1],
    ["media.daily_cap_per_brand", 10_001],
    ["factory.moq_by_article", { "Crew Tee": 10 }],
    ["factory.moq_by_article", { "crew-tee": 0 }],
    ["factory.price_ladder", []],
    ["factory.price_ladder", [{ fromPieces: 10, unitPrice: -1 }]],
    ["factory.lead_time_days", 0],
    ["factory.file_formats", [""]],
    ["factory.hs_codes", { "crew-tee": "abc" }],
  ];

  it.each(bad)("%s rejects %j", (key, value) => {
    expect(findSetting(key)!.schema.safeParse(value).success).toBe(false);
  });

  it("accepts a good value for each kind", () => {
    expect(findSetting("ops.lead_time_days")!.schema.safeParse(null).success).toBe(true);
    expect(findSetting("factory.price_ladder")!.schema.safeParse([{ fromPieces: 10, unitPrice: 32.5 }]).success).toBe(true);
    expect(findSetting("factory.hs_codes")!.schema.safeParse({ "crew-tee": "6109.10" }).success).toBe(true);
  });

  it("does not know a key it was not given", () => {
    expect(findSetting("stripe.secret_key")).toBeUndefined();
  });
});
