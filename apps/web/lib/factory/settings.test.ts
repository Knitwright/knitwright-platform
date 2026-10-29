import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SETTINGS, findSetting } from "@/lib/settings/registry";
import type { StoredSettings } from "@/lib/settings/types";
import { DEFAULT_PRODUCTION_SETTINGS, loadProductionSettings, productionSettingsWith } from "./production-settings";
import { CUTOFF_MINUTES_KEY, CUTOFF_WEEKDAY_KEY, DEFAULT_CUTOFF, FACTORY_SETTINGS, QC_DAYS_KEY } from "./settings";

/**
 * The cut-off is data, not a literal (plan v5: "The Monday 12:00 Pakistan-time cut-off is data"). It is a
 * platform setting with a history, and its placeholder default is Monday 12:00 on the factory's own clock.
 */

const stored = (values: Readonly<Record<string, unknown>>): StoredSettings =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value, setBy: null, setAt: "2026-10-29T00:00:00Z" }]));

describe("FACTORY_SETTINGS", () => {
  it("registers the cut-off and the QC days with the settings console", () => {
    for (const def of FACTORY_SETTINGS) expect(findSetting(def.key), def.key).toBe(def);
    expect(SETTINGS.filter((s) => s.key.startsWith("production.")).length).toBe(FACTORY_SETTINGS.length);
  });

  it("defaults to Monday 12:00, the spec's Class A cut-off, and to no agreed QC days", () => {
    expect(DEFAULT_CUTOFF).toEqual({ weekday: 1, minutes: 720 });
    expect(findSetting(CUTOFF_WEEKDAY_KEY)?.fallback).toBe(1);
    expect(findSetting(CUTOFF_MINUTES_KEY)?.fallback).toBe(720);
    expect(findSetting(QC_DAYS_KEY)?.fallback).toBeNull();
  });

  it("refuses a day or a time outside the week, and a negative number of QC days", () => {
    expect(findSetting(CUTOFF_WEEKDAY_KEY)?.schema.safeParse(7).success).toBe(false);
    expect(findSetting(CUTOFF_MINUTES_KEY)?.schema.safeParse(1440).success).toBe(false);
    expect(findSetting(CUTOFF_MINUTES_KEY)?.schema.safeParse(1439).success).toBe(true);
    expect(findSetting(QC_DAYS_KEY)?.schema.safeParse(-1).success).toBe(false);
    expect(findSetting(QC_DAYS_KEY)?.schema.safeParse(null).success).toBe(true);
  });

  it("registers no secret and says on every line that the value is a placeholder or not agreed", () => {
    for (const def of FACTORY_SETTINGS) {
      expect(def.key, def.key).not.toMatch(/key|token|secret/i);
      expect(def.help, def.key).toMatch(/placeholder|agreed/i);
    }
  });
});

describe("productionSettingsWith", () => {
  it("is the placeholder while nothing is stored", () => {
    expect(productionSettingsWith({})).toEqual(DEFAULT_PRODUCTION_SETTINGS);
  });

  it("takes the stored day, time and QC days", () => {
    expect(productionSettingsWith(stored({ [CUTOFF_WEEKDAY_KEY]: 3, [CUTOFF_MINUTES_KEY]: 9 * 60, [QC_DAYS_KEY]: 2 }))).toEqual({
      cutoff: { weekday: 3, minutes: 540 },
      qcDays: 2,
      isPlaceholder: false,
    });
  });

  it("stops calling them placeholders as soon as one is set, and keeps the default for the rest", () => {
    expect(productionSettingsWith(stored({ [QC_DAYS_KEY]: 2 }))).toEqual({ cutoff: DEFAULT_CUTOFF, qcDays: 2, isPlaceholder: false });
  });

  it("ignores a stored value that no longer passes its schema", () => {
    expect(productionSettingsWith(stored({ [CUTOFF_WEEKDAY_KEY]: 99 }))).toEqual(DEFAULT_PRODUCTION_SETTINGS);
  });
});

const client = (answer: { data?: unknown; error?: { message: string } }): SupabaseClient =>
  ({ from: () => ({ select: () => Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }) }) }) as unknown as SupabaseClient;

describe("loadProductionSettings", () => {
  it("reads the stored values through the settings table", async () => {
    const rows = [{ key: QC_DAYS_KEY, value: 3, set_by: null, set_at: "2026-10-29T00:00:00Z" }];
    expect(await loadProductionSettings(client({ data: rows }))).toEqual({ cutoff: DEFAULT_CUTOFF, qcDays: 3, isPlaceholder: false });
  });

  it("falls back to the placeholder when the read fails, so the page still renders", async () => {
    expect(await loadProductionSettings(client({ error: { message: "down" } }))).toEqual(DEFAULT_PRODUCTION_SETTINGS);
  });
});
