import type { SupabaseClient } from "@supabase/supabase-js";
import { storedValue } from "@/lib/settings/resolve";
import { loadStored } from "@/lib/settings/store";
import { DEFAULT_THIRD_PARTY_OVER_PIECES, THIRD_PARTY_MIN_PIECES_KEY } from "./settings";

/** The threshold in force: the stored setting, or the spec's own figure while nothing is stored. */
export async function loadThirdPartyOverPieces(admin: SupabaseClient): Promise<number> {
  try {
    const stored = storedValue(await loadStored(admin), THIRD_PARTY_MIN_PIECES_KEY);
    return typeof stored === "number" ? stored : DEFAULT_THIRD_PARTY_OVER_PIECES;
  } catch {
    return DEFAULT_THIRD_PARTY_OVER_PIECES;
  }
}
