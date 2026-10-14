import type { SupabaseClient } from "@supabase/supabase-js";
import { createAssetReader } from "@/lib/artwork-intake";
import type { AssetReader } from "@/lib/artwork-stack";
import type { PrintRuleSet } from "@/lib/production/contract";
import { AppError } from "@/lib/server/core/errors";
import { createFileReader } from "@/lib/storage/read";
import { listLeagueRules, loadPrintProfile, type StoredPrintProfile } from "../profiles";

/** A colour profile is a few hundred KB at most; this is far more than one needs. */
const ICC_MAX_BYTES = 8 * 1024 * 1024;

export const RULES_NOT_FOUND_TEXT = "That rule set does not exist.";

const NO_RULES: PrintRuleSet = { minTextHeightMm: null, minLineMm: null, coloursToAvoid: [], numberRules: null };

export interface PrintContext {
  readonly profile: StoredPrintProfile;
  /** The print house's colour profile, or null when the brand has none (or it could not be read). */
  readonly icc: Uint8Array | null;
  readonly rules: PrintRuleSet;
  /** Reads a user's artwork for this brand only. It is the only way print files see a user's picture. */
  readonly assets: AssetReader;
}

export interface Clients {
  /** The signed-in person's own client: the database decides what they may read. */
  readonly client: SupabaseClient;
  /** The server's client, used only by the artwork reader, which answers for one brand. */
  readonly admin: SupabaseClient;
}

/**
 * Everything besides the design and the pattern that print files are made with: the brand's profile and colour
 * profile, a league rule set when one is named (else no rules, and the files say so), and the brand's artwork reader.
 */
export async function loadPrintContext(clients: Clients, brandId: string, ruleSetId?: string): Promise<PrintContext> {
  const profile = await loadPrintProfile(clients.client, brandId);
  const stored = profile.iccFileId ? await createFileReader(clients.client, brandId).read(profile.iccFileId, ICC_MAX_BYTES) : null;
  const icc = stored && stored !== "too-large" ? stored.bytes : null;
  let rules = NO_RULES;
  if (ruleSetId !== undefined) {
    const found = (await listLeagueRules(clients.client, brandId)).find((entry) => entry.id === ruleSetId);
    if (!found) throw new AppError("not_found", RULES_NOT_FOUND_TEXT);
    rules = found.rules;
  }
  return { profile, icc, rules, assets: createAssetReader(clients.admin, brandId) };
}
