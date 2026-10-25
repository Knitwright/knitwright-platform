import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { DEFAULT_OPS_SETTINGS } from "@/lib/ops/settings";
import { saveSettings } from "@/lib/ops/service";
import { defaultFactoryProfile, factoryProfileSchema } from "@/lib/validation/profile";
import { DEFAULT_PROFILE_ID } from "@/lib/validation/service";
import { factoryProfileWith, opsSettingsWith } from "./resolve";
import { loadNames, loadStored } from "./store";

/**
 * After a change, brings the tables that other code already reads up to date. Ops and the factory profile are
 * read from their own tables everywhere, so the change is written through to them; credit prices are written to
 * credit_prices (syncCreditPrices); guardrails and the credit service read the stored value directly.
 */
export async function applyChange(admin: SupabaseClient, actor: string, key: string, sync: () => Promise<void>): Promise<void> {
  const stored = await loadStored(admin);
  const names = await loadNames(admin, Object.values(stored).flatMap((s) => (s.setBy ? [s.setBy] : [])));
  if (key.startsWith("ops.")) {
    await saveSettings(admin, actor, opsSettingsWith(DEFAULT_OPS_SETTINGS, stored, names));
  } else if (key.startsWith("factory.")) {
    const profile = factoryProfileSchema.parse(factoryProfileWith(defaultFactoryProfile(), stored, names));
    const { error } = await admin
      .from("factory_profiles")
      .upsert({ id: DEFAULT_PROFILE_ID, name: profile.name, label: profile.label, profile, updated_at: new Date().toISOString() });
    if (error) throw new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  } else if (key.startsWith("credits.price_")) {
    await sync();
  }
}
