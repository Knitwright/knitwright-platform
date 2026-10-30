import type { CreditSettingsShape } from "@/lib/credits/settings";
import type { GuardrailSettings } from "@/lib/guardrails/types";
import type { OpsSettings } from "@/lib/ops/settings";
import type { FactoryProfile } from "@/lib/validation/profile";
import { findSetting } from "./registry";
import type { StoredSettings } from "./types";

/**
 * Pure functions that lay stored settings over the in-code defaults. A stored value that no longer passes its
 * schema is ignored (the default is used), so a bad row can never break a page.
 */

/** The stored value of a key, or undefined when nothing valid is stored. */
export function storedValue(stored: StoredSettings, key: string): unknown {
  const def = findSetting(key);
  const row = stored[key];
  if (!def || !row) return undefined;
  const parsed = def.schema.safeParse(row.value);
  return parsed.success ? parsed.data : undefined;
}

/** The stored value, or the setting's default. */
export function valueOf(stored: StoredSettings, key: string): unknown {
  return storedValue(stored, key) ?? findSetting(key)?.fallback;
}

/** "Set by <admin> on <date>" for the latest change among the keys, or null when none is stored. */
export function provenance(stored: StoredSettings, keys: readonly string[], names: Readonly<Record<string, string>>): string | null {
  const rows = keys.flatMap((key) => (storedValue(stored, key) === undefined ? [] : [stored[key]!]));
  const latest = [...rows].sort((a, b) => a.setAt.localeCompare(b.setAt)).at(-1);
  if (!latest) return null;
  const who = (latest.setBy && names[latest.setBy]) || "a platform admin";
  return `Set by ${who} on ${latest.setAt.slice(0, 10)}`;
}

const OPS_KEYS = ["ops.cutoff_weekday", "ops.cutoff_minutes", "ops.lead_time_days"] as const;

export function opsSettingsWith(base: OpsSettings, stored: StoredSettings, names: Readonly<Record<string, string>> = {}): OpsSettings {
  const label = provenance(stored, OPS_KEYS, names);
  if (label === null) return base;
  return {
    cutoffWeekday: (storedValue(stored, OPS_KEYS[0]) as number | undefined) ?? base.cutoffWeekday,
    cutoffMinutes: (storedValue(stored, OPS_KEYS[1]) as number | undefined) ?? base.cutoffMinutes,
    leadTimeDays: (storedValue(stored, OPS_KEYS[2]) as number | undefined) ?? base.leadTimeDays,
    label,
  };
}

export function guardrailSettingsWith(base: GuardrailSettings, stored: StoredSettings): GuardrailSettings {
  const pick = (key: string, current: GuardrailSettings["minDpi"]): GuardrailSettings["minDpi"] => {
    const value = storedValue(stored, key) as number | undefined;
    return value === undefined ? current : { value, source: "print-house" };
  };
  return {
    minDpi: pick("guardrails.min_dpi", base.minDpi),
    bleedMm: pick("guardrails.bleed_mm", base.bleedMm),
    safeZoneMm: pick("guardrails.safe_zone_mm", base.safeZoneMm),
  };
}

const PRICE_KEYS = [
  ["marketing_media", "credits.price_marketing_media"],
  ["techpack_pdf", "credits.price_techpack_pdf"],
  ["pattern_file", "credits.price_pattern_file"],
  ["production_package", "credits.price_production_package"],
] as const;

export function creditSettingsWith(base: CreditSettingsShape, stored: StoredSettings): CreditSettingsShape {
  const prices = { ...base.prices };
  for (const [kind, key] of PRICE_KEYS) prices[kind] = (storedValue(stored, key) as number | undefined) ?? prices[kind];
  const allStored = PRICE_KEYS.every(([, key]) => storedValue(stored, key) !== undefined);
  return {
    // The prices stop being placeholders only once an admin has set every one of them.
    isPlaceholder: base.isPlaceholder && !allStored,
    prices,
    monthlyAllowance: (storedValue(stored, "credits.monthly_allowance") as number | undefined) ?? base.monthlyAllowance,
  };
}

const FACTORY_KEYS = [
  "factory.moq_by_article",
  "factory.price_ladder",
  "factory.lead_time_days",
  "factory.file_formats",
  "factory.hs_codes",
] as const;

const settable = <T>(value: T | undefined) => (value === undefined ? ({ status: "not-set" } as const) : ({ status: "set", value } as const));

/** The factory profile with the admin's terms laid over it. Unchanged when no factory term is stored. */
export function factoryProfileWith(base: FactoryProfile, stored: StoredSettings, names: Readonly<Record<string, string>> = {}): FactoryProfile {
  const label = provenance(stored, FACTORY_KEYS, names);
  if (label === null) return base;
  const moq = (storedValue(stored, FACTORY_KEYS[0]) ?? {}) as Record<string, number>;
  const hs = (storedValue(stored, FACTORY_KEYS[4]) ?? {}) as Record<string, string>;
  return {
    ...base,
    label,
    articles: base.articles.map((a) => (moq[a.typeId] === undefined ? a : { ...a, moq: settable(moq[a.typeId]) })),
    priceLadder: settable(storedValue(stored, FACTORY_KEYS[1]) as { fromPieces: number; unitPrice: number }[] | undefined),
    leadTimeDays: settable(storedValue(stored, FACTORY_KEYS[2]) as number | undefined),
    fileFormats: (storedValue(stored, FACTORY_KEYS[3]) as string[] | undefined) ?? base.fileFormats,
    hsCodes: Object.keys(hs).length === 0 ? base.hsCodes : settable(hs),
  };
}
