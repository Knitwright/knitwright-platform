import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { printRuleSetSchema, type PrintRuleSet } from "@/lib/production/contract";
import { AppError } from "@/lib/server/core/errors";
import { EMPTY_RULES, type LeagueRuleSet } from "../rules";
import type { LeagueRuleSetInput } from "./schemas";

const row = z.object({ id: z.uuid(), name: z.string(), source: z.string(), rules: printRuleSetSchema });

export const RULE_SET_NOT_FOUND = "That rule set does not exist.";
export const RULE_SET_NAME_TAKEN = "You already have a rule set with that name.";
export const MAX_RULE_SETS = 30;
export const TOO_MANY_RULE_SETS = `A brand can keep ${MAX_RULE_SETS} rule sets. Remove one you no longer use before adding another.`;

export type StoredRuleSet = LeagueRuleSet & { readonly uuid: string };

export async function listRuleSets(client: SupabaseClient, brandId: string): Promise<readonly StoredRuleSet[]> {
  const { data, error } = await client.from("league_rule_sets").select("id, name, source, rules").eq("brand_id", brandId).order("name");
  if (error) throw new Error("The league rule sets could not be read.", { cause: error });
  const parsed = z.array(row).safeParse(data ?? []);
  if (!parsed.success) throw new Error("The database gave an unexpected answer for league rule sets.");
  return parsed.data.map((r) => ({ uuid: r.id, id: r.id, name: r.name, source: r.source, rules: r.rules }));
}

/** The rules a design is printed under: the chosen set, or none (said so in the margin of each file). */
export async function rulesFor(client: SupabaseClient, brandId: string, ruleSetId: string | undefined): Promise<PrintRuleSet> {
  if (ruleSetId === undefined) return EMPTY_RULES;
  const found = (await listRuleSets(client, brandId)).find((r) => r.uuid === ruleSetId);
  if (found === undefined) throw new AppError("not_found", RULE_SET_NOT_FOUND);
  return found.rules;
}

type Who = Readonly<{ brandId: string; userId: string }>;

export async function createRuleSet(admin: SupabaseClient, who: Who, input: LeagueRuleSetInput): Promise<string> {
  const count = await admin.from("league_rule_sets").select("id").eq("brand_id", who.brandId);
  if (count.error) throw new Error("The rule sets could not be counted.", { cause: count.error });
  if ((count.data ?? []).length >= MAX_RULE_SETS) throw new AppError("invalid_input", TOO_MANY_RULE_SETS);
  const { data, error } = await admin
    .from("league_rule_sets")
    .insert({ brand_id: who.brandId, name: input.name, source: input.source, rules: input.rules, created_by: who.userId })
    .select("id")
    .single();
  if (error?.code === "23505") throw new AppError("conflict", RULE_SET_NAME_TAKEN);
  if (error) throw new Error("The rule set could not be saved.", { cause: error });
  return z.object({ id: z.uuid() }).parse(data).id;
}

export async function deleteRuleSet(admin: SupabaseClient, who: Who, id: string): Promise<void> {
  const found = await admin.from("league_rule_sets").select("id").eq("id", id).eq("brand_id", who.brandId).maybeSingle();
  if (found.error) throw new Error("The rule set could not be read.", { cause: found.error });
  if (!found.data) throw new AppError("not_found", RULE_SET_NOT_FOUND);
  const { error } = await admin.from("league_rule_sets").delete().eq("id", id).eq("brand_id", who.brandId);
  if (error) throw new Error("The rule set could not be removed.", { cause: error });
}
