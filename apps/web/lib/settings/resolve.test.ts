import { describe, expect, it } from "vitest";
import { CREDIT_SETTINGS } from "@/lib/credits/settings";
import { DEFAULT_SETTINGS } from "@/lib/guardrails/settings";
import { DEFAULT_OPS_SETTINGS } from "@/lib/ops/settings";
import { defaultFactoryProfile, factoryProfileSchema } from "@/lib/validation/profile";
import { creditSettingsWith, factoryProfileWith, guardrailSettingsWith, opsSettingsWith, provenance, storedValue, valueOf } from "./resolve";
import type { StoredSettings } from "./types";

const at = "2026-10-27T08:00:00.000Z";
const row = (value: unknown, setBy: string | null = "u1", setAt = at) => ({ value, setBy, setAt });
const names = { u1: "ada@example.com" };

describe("with nothing stored, every module is unchanged", () => {
  it("returns the very same objects", () => {
    expect(opsSettingsWith(DEFAULT_OPS_SETTINGS, {})).toBe(DEFAULT_OPS_SETTINGS);
    expect(guardrailSettingsWith(DEFAULT_SETTINGS, {})).toEqual(DEFAULT_SETTINGS);
    expect(creditSettingsWith(CREDIT_SETTINGS, {})).toEqual(CREDIT_SETTINGS);
    const profile = defaultFactoryProfile();
    expect(factoryProfileWith(profile, {})).toBe(profile);
  });

  it("falls back to the default for a stored value that no longer passes its schema", () => {
    const stored: StoredSettings = { "guardrails.min_dpi": row("junk"), "unknown.key": row(1) };
    expect(storedValue(stored, "guardrails.min_dpi")).toBeUndefined();
    expect(storedValue(stored, "unknown.key")).toBeUndefined();
    expect(valueOf(stored, "guardrails.min_dpi")).toBe(150);
    expect(guardrailSettingsWith(DEFAULT_SETTINGS, stored)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("provenance", () => {
  it("names the admin and the date of the latest change", () => {
    const stored = { "ops.cutoff_weekday": row(4, "u1", "2026-10-26T00:00:00Z"), "ops.cutoff_minutes": row(420, "u2", at) };
    expect(provenance(stored, ["ops.cutoff_weekday"], names)).toBe("Set by ada@example.com on 2026-10-26");
    expect(provenance(stored, ["ops.cutoff_weekday", "ops.cutoff_minutes"], names)).toBe("Set by a platform admin on 2026-10-27");
    expect(provenance({}, ["ops.cutoff_weekday"], names)).toBeNull();
  });
});

describe("ops", () => {
  it("lays the stored cut-off over the default and says who set it", () => {
    const stored = { "ops.cutoff_weekday": row(5), "ops.cutoff_minutes": row(420) };
    expect(opsSettingsWith(DEFAULT_OPS_SETTINGS, stored, names)).toEqual({
      cutoffWeekday: 5,
      cutoffMinutes: 420,
      leadTimeDays: null,
      label: "Set by ada@example.com on 2026-10-27",
    });
  });

  it("keeps the other defaults when only one value is stored", () => {
    const set = opsSettingsWith(DEFAULT_OPS_SETTINGS, { "ops.lead_time_days": row(21) }, names);
    expect(set).toMatchObject({ cutoffWeekday: 5, cutoffMinutes: 1020, leadTimeDays: 21 });
  });
});

describe("guardrails", () => {
  it("lays stored values over the defaults, each labelled as set by the owner's side", () => {
    const set = guardrailSettingsWith(DEFAULT_SETTINGS, { "guardrails.bleed_mm": row(15) });
    expect(set.bleedMm).toEqual({ value: 15, source: "print-house" });
    expect(set.minDpi).toEqual(DEFAULT_SETTINGS.minDpi);
  });
});

describe("credits", () => {
  it("lays stored prices and allowance over the placeholders, which stay placeholders until all three prices are set", () => {
    const two = creditSettingsWith(CREDIT_SETTINGS, { "credits.price_marketing_media": row(5), "credits.price_techpack_pdf": row(2), "credits.monthly_allowance": row(10) });
    expect(two.prices).toEqual({ marketing_media: 5, techpack_pdf: 2, pattern_file: 1 });
    expect(two.isPlaceholder).toBe(true);
    const all = creditSettingsWith(CREDIT_SETTINGS, { "credits.price_marketing_media": row(5), "credits.price_techpack_pdf": row(2), "credits.price_pattern_file": row(3), "credits.monthly_allowance": row(12) });
    expect(all).toEqual({ isPlaceholder: false, prices: { marketing_media: 5, techpack_pdf: 2, pattern_file: 3 }, monthlyAllowance: 12 });
  });

  it("does not change the placeholder object", () => {
    creditSettingsWith(CREDIT_SETTINGS, { "credits.price_marketing_media": row(9) });
    expect(CREDIT_SETTINGS.prices.marketing_media).toBe(1);
  });
});

describe("factory profile", () => {
  const stored: StoredSettings = {
    "factory.moq_by_article": row({ "crew-tee": 10, "not-an-article": 5 }),
    "factory.price_ladder": row([{ fromPieces: 10, unitPrice: 32.5 }]),
    "factory.lead_time_days": row(10),
    "factory.file_formats": row(["pdf", "dxf"]),
    "factory.hs_codes": row({ "crew-tee": "6109.10" }),
  };

  it("sets the terms, still passes the profile schema, and is labelled with who set it", () => {
    const profile = factoryProfileWith(defaultFactoryProfile(), stored, names);
    expect(factoryProfileSchema.safeParse(profile).success).toBe(true);
    expect(profile.label).toBe("Set by ada@example.com on 2026-10-27");
    expect(profile.articles.find((a) => a.typeId === "crew-tee")?.moq).toEqual({ status: "set", value: 10 });
    expect(profile.articles.filter((a) => a.moq.status === "set")).toHaveLength(1);
    expect(profile.priceLadder).toEqual({ status: "set", value: [{ fromPieces: 10, unitPrice: 32.5 }] });
    expect(profile.leadTimeDays).toEqual({ status: "set", value: 10 });
    expect(profile.fileFormats).toEqual(["pdf", "dxf"]);
    expect(profile.hsCodes).toEqual({ status: "set", value: { "crew-tee": "6109.10" } });
  });

  it("leaves what was not set as 'not set' and never invents it", () => {
    const profile = factoryProfileWith(defaultFactoryProfile(), { "factory.file_formats": row(["pdf"]) }, names);
    expect(profile.priceLadder).toEqual({ status: "not-set" });
    expect(profile.leadTimeDays).toEqual({ status: "not-set" });
    expect(profile.hsCodes).toEqual({ status: "not-set" });
  });
});
