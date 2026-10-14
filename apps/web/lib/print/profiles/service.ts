import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";
import { profileFromRow, profileRowSchema, ruleRowSchema, ruleSetFromRow } from "./rows";
import {
  DEFAULT_PRINT_PROFILE,
  MAX_LEAGUE_RULE_SETS,
  type LeagueRuleSet,
  type LeagueRulesInput,
  type PrintProfileInput,
  type StoredPrintProfile,
} from "./schemas";

/**
 * A brand's print profile and league rule sets. Reads for a person go through their own client, so
 * the database's rules decide what they see. Every write goes through the server's client, and the
 * brand always comes from the session, never from the request.
 */

type Who = Readonly<{ brandId: string; userId: string }>;

const failIf = (error: { message: string } | null, what: string): void => {
  if (error) throw new Error(what, { cause: error });
};

export const ICC_NOT_FOUND = "That colour profile is not one of your print or pattern files. Upload it again.";
export const RULES_NOT_FOUND = "That rule set does not exist.";
export const RULES_NAME_TAKEN = "You already have a rule set with that name.";
export const TOO_MANY_RULE_SETS = `A brand can keep ${MAX_LEAGUE_RULE_SETS} rule sets. Remove one you no longer use before adding another.`;

/** The brand's saved profile, or the labelled defaults when it has not saved one. */
export async function loadPrintProfile(client: SupabaseClient, brandId: string): Promise<StoredPrintProfile> {
  const { data, error } = await client.from("print_profiles").select("*").eq("brand_id", brandId).maybeSingle();
  failIf(error, "The print profile could not be read.");
  if (!data) return DEFAULT_PRINT_PROFILE;
  const parsed = profileRowSchema.safeParse(data);
  if (!parsed.success) throw new Error("The database gave an unexpected answer for the print profile.");
  return profileFromRow(parsed.data);
}

async function requireIccFile(admin: SupabaseClient, brandId: string, fileId: string): Promise<void> {
  const { data, error } = await admin
    .from("files")
    .select("id")
    .eq("id", fileId)
    .eq("brand_id", brandId)
    .in("kind", ["print", "pattern-source"])
    .maybeSingle();
  failIf(error, "The colour profile could not be read.");
  if (!data) throw new AppError("not_found", ICC_NOT_FOUND);
}

/** Saves the brand's profile. A profile a member saved is marked as from their print house. */
export async function savePrintProfile(admin: SupabaseClient, who: Who, input: PrintProfileInput): Promise<void> {
  if (input.iccFileId) await requireIccFile(admin, who.brandId, input.iccFileId);
  const { error } = await admin.from("print_profiles").upsert(
    {
      brand_id: who.brandId,
      bleed_mm: input.bleedMm,
      dpi: input.dpi,
      min_dpi: input.minDpi,
      icc_file_id: input.iccFileId,
      max_print_width_mm: input.maxPrintWidthMm,
      source: "print-house",
      updated_by: who.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "brand_id" },
  );
  failIf(error, "The print profile could not be saved.");
}

export async function listLeagueRules(client: SupabaseClient, brandId: string): Promise<readonly LeagueRuleSet[]> {
  const { data, error } = await client.from("league_rule_sets").select("*").eq("brand_id", brandId).order("name");
  failIf(error, "The league rules could not be read.");
  const parsed = z.array(ruleRowSchema).safeParse(data ?? []);
  if (!parsed.success) throw new Error("The database gave an unexpected answer for the league rules.");
  return parsed.data.map(ruleSetFromRow);
}

export async function saveLeagueRules(admin: SupabaseClient, who: Who, input: LeagueRulesInput): Promise<string> {
  const count = await admin.from("league_rule_sets").select("id").eq("brand_id", who.brandId);
  failIf(count.error, "The league rules could not be counted.");
  if ((count.data ?? []).length >= MAX_LEAGUE_RULE_SETS) throw new AppError("invalid_input", TOO_MANY_RULE_SETS);
  const { data, error } = await admin
    .from("league_rule_sets")
    .insert({
      brand_id: who.brandId,
      created_by: who.userId,
      name: input.name,
      source: input.source,
      rules: input.rules,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error?.code === "23505") throw new AppError("conflict", RULES_NAME_TAKEN);
  failIf(error, "The league rules could not be saved.");
  return z.object({ id: z.uuid() }).parse(data).id;
}

export async function updateLeagueRules(admin: SupabaseClient, who: Who, ruleId: string, input: LeagueRulesInput): Promise<void> {
  const { data, error } = await admin
    .from("league_rule_sets")
    .update({ name: input.name, source: input.source, rules: input.rules, updated_at: new Date().toISOString() })
    .eq("id", ruleId)
    .eq("brand_id", who.brandId)
    .select("id");
  if (error?.code === "23505") throw new AppError("conflict", RULES_NAME_TAKEN);
  failIf(error, "The league rules could not be saved.");
  if ((data ?? []).length === 0) throw new AppError("not_found", RULES_NOT_FOUND);
}

export async function deleteLeagueRules(admin: SupabaseClient, who: Who, ruleId: string): Promise<void> {
  const { data, error } = await admin.from("league_rule_sets").delete().eq("id", ruleId).eq("brand_id", who.brandId).select("id");
  failIf(error, "The league rules could not be removed.");
  if ((data ?? []).length === 0) throw new AppError("not_found", RULES_NOT_FOUND);
}
