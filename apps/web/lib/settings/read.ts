import type { SupabaseClient } from "@supabase/supabase-js";
import { CREDIT_SETTINGS, type CreditSettingsShape } from "@/lib/credits/settings";
import { DEFAULT_SETTINGS } from "@/lib/guardrails/settings";
import type { GuardrailSettings } from "@/lib/guardrails/types";
import { creditSettingsWith, guardrailSettingsWith } from "./resolve";
import { loadStored } from "./store";

/**
 * The read-through for modules that read a setting directly. With nothing stored these return the in-code defaults
 * unchanged, and so does a failed read: a page never breaks because the console's tables could not be read.
 */

export async function loadCreditSettings(admin: SupabaseClient): Promise<CreditSettingsShape> {
  try {
    return creditSettingsWith(CREDIT_SETTINGS, await loadStored(admin));
  } catch {
    return CREDIT_SETTINGS;
  }
}

export async function loadGuardrailSettings(admin: SupabaseClient): Promise<GuardrailSettings> {
  try {
    return guardrailSettingsWith(DEFAULT_SETTINGS, await loadStored(admin));
  } catch {
    return DEFAULT_SETTINGS;
  }
}
