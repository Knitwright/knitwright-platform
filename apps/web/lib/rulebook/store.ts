import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { ConfirmInput, RuleInput } from "./input";
import { inForce, selectRules, type InForce, type RuleFilter, type RuleReader } from "./select";
import { entryRow, gapRow, RULE_ID, toEntry, type RulebookEntry, type RulebookGap } from "./types";

/**
 * Reads and writes of the rulebook (decision 0067). Signed-in people may read `rulebook_entries` with their own
 * client; the gaps are read with the server's key only. Every write goes through a database function that only the
 * server's key may call, and the edit and confirm functions refuse anyone who is not a platform admin.
 */

/** The columns a signed-in member may read. Who wrote or confirmed a rule is the server's business. */
const COLUMNS =
  "id, rule_id, version, topic, article_codes, scope_methods, scope_note, title, rule, body, best_practice, source, source_note, status, confirmed_name, confirmed_role, confirmed_at, created_at";
const ADMIN_COLUMNS = `${COLUMNS}, confirmed_by`;

const failed = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

/**
 * Every version of every rule. The rulebook is small (hundreds of rows), so it is read whole. With the server's key,
 * `withPeople` also reads who confirmed each version.
 */
export async function loadEntries(client: SupabaseClient, withPeople = false): Promise<RulebookEntry[]> {
  const { data, error } = await client.from("rulebook_entries").select(withPeople ? ADMIN_COLUMNS : COLUMNS).order("rule_id").order("version");
  if (error) throw failed(error);
  return z.array(entryRow).parse(data ?? []).map(toEntry);
}

const NO_RULE: InForce = { shown: null, newerDraft: null, newest: null };

/**
 * The version of a rule this reader may see, out of every version of it, with the newest version alongside so the
 * caller can tell "no such rule" from "nothing confirmed yet" (owner decision 11). A rule has a handful of
 * versions, so they are all read and chosen between here.
 */
export async function resolveRule(client: SupabaseClient, ruleId: string, reader: RuleReader = "member"): Promise<InForce> {
  if (!RULE_ID.test(ruleId)) return NO_RULE;
  const { data, error } = await client
    .from("rulebook_entries")
    .select(COLUMNS)
    .eq("rule_id", ruleId)
    .order("version", { ascending: false });
  if (error) throw failed(error);
  const versions = z.array(entryRow).parse(data ?? []).map(toEntry);
  return versions.length > 0 ? inForce(versions, reader) : NO_RULE;
}

/** The rules in force for an article, a method and a topic, as this reader may see them. */
export async function rulesFor(
  client: SupabaseClient,
  filter: RuleFilter,
  reader: RuleReader = "member",
): Promise<RulebookEntry[]> {
  return selectRules(await loadEntries(client), filter, reader);
}

export type GapNote = Readonly<{ code: string; context: string }>;

/** Counts one more meeting with a question or check code that has no entry. Needs the server's key. */
export async function logGap(admin: SupabaseClient, gap: GapNote): Promise<void> {
  const { error } = await admin.rpc("rulebook_gap_log", { p_code: gap.code.slice(0, 200), p_context: gap.context.slice(0, 500) });
  if (error) throw failed(error);
}

/** The gaps, most often met first. Needs the server's key. */
export async function loadGaps(admin: SupabaseClient): Promise<RulebookGap[]> {
  const { data, error } = await admin
    .from("rulebook_gaps")
    .select("code, context, count, first_seen, last_seen")
    .order("count", { ascending: false })
    .order("code");
  if (error) throw failed(error);
  return z
    .array(gapRow)
    .parse(data ?? [])
    .map((r) => ({ code: r.code, context: r.context, count: r.count, firstSeen: r.first_seen, lastSeen: r.last_seen }));
}

/** What the database answers when a confirmation names nobody. The form asks for both before it is sent. */
export const NEEDS_A_PERSON = "Write the name and role of the factory person who reviewed the rule.";

const notFoundOr = (error: { code?: string } | null): void => {
  if (error?.code === "P0002") throw new AppError("not_found", "Not found.");
  if (error) throw failed(error);
};

/** Adds the next version of a rule (or version 1 of a new one), as a draft. Returns the new version number. */
export async function saveEntry(admin: SupabaseClient, actor: string, input: RuleInput): Promise<number> {
  const { data, error } = await admin.rpc("rulebook_entry_save", {
    p_actor: actor,
    p_rule_id: input.ruleId,
    p_topic: input.topic,
    p_article_codes: input.articleCodes,
    p_scope_methods: input.methods,
    p_scope_note: input.scopeNote,
    p_title: input.title,
    p_rule: input.rule,
    p_body: input.body,
    p_best_practice: input.bestPractice,
    p_source: input.source,
    p_source_note: input.sourceNote,
  });
  notFoundOr(error);
  return z.number().int().parse(data);
}

/**
 * Marks one draft version as confirmed by the factory, naming the factory person who reviewed it and their role
 * (owner decision 14). A confirmation by nobody in particular is refused by the database as well as by the form.
 */
export async function confirmEntry(admin: SupabaseClient, actor: string, input: ConfirmInput): Promise<void> {
  const { error } = await admin.rpc("rulebook_entry_confirm", {
    p_actor: actor,
    p_rule_id: input.ruleId,
    p_version: input.version,
    p_name: input.confirmedName,
    p_role: input.confirmedRole,
  });
  if (error?.code === "P0001") throw new AppError("invalid_input", NEEDS_A_PERSON);
  notFoundOr(error);
}
