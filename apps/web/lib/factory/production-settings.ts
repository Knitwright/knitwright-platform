import type { SupabaseClient } from "@supabase/supabase-js";
import { storedValue } from "@/lib/settings/resolve";
import { loadStored } from "@/lib/settings/store";
import type { StoredSettings } from "@/lib/settings/types";
import type { CutoffSetting } from "./dates";
import { CUTOFF_MINUTES_KEY, CUTOFF_WEEKDAY_KEY, DEFAULT_CUTOFF, QC_DAYS_KEY } from "./settings";

export interface ProductionSettings {
  readonly cutoff: CutoffSetting;
  readonly qcDays: number | null;
  /** True while every value is the Knitwright placeholder. */
  readonly isPlaceholder: boolean;
}

export const DEFAULT_PRODUCTION_SETTINGS: ProductionSettings = { cutoff: DEFAULT_CUTOFF, qcDays: null, isPlaceholder: true };

/** The stored values laid over the defaults. A stored value that fails its schema is ignored. */
export function productionSettingsWith(stored: StoredSettings): ProductionSettings {
  const weekday = storedValue(stored, CUTOFF_WEEKDAY_KEY) as number | undefined;
  const minutes = storedValue(stored, CUTOFF_MINUTES_KEY) as number | undefined;
  const qcDays = storedValue(stored, QC_DAYS_KEY) as number | null | undefined;
  return {
    cutoff: { weekday: weekday ?? DEFAULT_CUTOFF.weekday, minutes: minutes ?? DEFAULT_CUTOFF.minutes },
    qcDays: qcDays ?? null,
    isPlaceholder: weekday === undefined && minutes === undefined && qcDays === undefined,
  };
}

/** The read-through: with nothing stored, or a failed read, the defaults. */
export async function loadProductionSettings(admin: SupabaseClient): Promise<ProductionSettings> {
  try {
    return productionSettingsWith(await loadStored(admin));
  } catch {
    return DEFAULT_PRODUCTION_SETTINGS;
  }
}
