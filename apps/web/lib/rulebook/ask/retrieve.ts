import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { inScope, scopeLabel } from "../scope";
import { inForce, type RuleReader } from "../select";
import { entryRow, RULE_ID, toEntry, type RulebookEntry } from "../types";
import { NEWER_DRAFT_LINE } from "../view";
import type { AskScope, RetrievedRule, SearchHit } from "./types";

/**
 * Retrieval over the rulebook, scoped to the design (spec F-S5 v2, decision 0083). `rulebook_search` ranks the
 * rules whose words match the question and says how many of the question's words each one holds; this chooses
 * which of them are worth answering from, and which VERSION of each the reader may be shown.
 *
 * Owner decision 11 is applied here, not in the browser: the versions are read with the server's key and
 * `inForce` picks the newest one the factory has signed off, so a draft's words never leave the server for a
 * member. Owner decision 12 is applied in SQL, so a method-scoped rule is never stretched over another article.
 */

/** How many rules an answer may draw on. Enough for a question with two sides, short enough to stay readable. */
export const MAX_RULES = 6;

/**
 * How many of the question's words a rule must hold before it is worth answering from. One word in common is
 * usually the topic alone ("seam", "fabric"), which is how a plausible answer to a question nobody wrote a rule
 * for gets built; two is the floor. A question with only one searchable word is matched on that one.
 */
export const MIN_MATCHED = 2;

const hitRow = z.object({ rule_id: z.string(), rank: z.number(), matched: z.number().int(), asked: z.number().int() });

const failed = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

/** The columns of a version, as the entry schema names them. `confirmed_by` is the server's own business. */
const COLUMNS = Object.keys(entryRow.shape)
  .filter((column) => column !== "confirmed_by")
  .join(", ");

/** The rules whose words match the question, ranked, within the scope asked about. */
export async function searchRulebook(
  admin: SupabaseClient,
  question: string,
  scope: AskScope,
  limit = MAX_RULES,
): Promise<SearchHit[]> {
  const { data, error } = await admin.rpc("rulebook_search", {
    p_query: question.slice(0, 500),
    p_article_code: scope.articleCode ?? null,
    p_method: scope.method ?? null,
    p_limit: limit,
  });
  if (error) throw failed(error);
  return z
    .array(hitRow)
    .parse(data ?? [])
    .map((row) => ({ ruleId: row.rule_id, rank: row.rank, matched: row.matched, asked: row.asked }));
}

/**
 * The hits worth answering from. A hit that holds fewer of the question's words than the floor is dropped: the
 * answer is better off saying nothing covers the question than restating a rule about something else.
 */
export const shortlist = (hits: readonly SearchHit[], limit = MAX_RULES): SearchHit[] =>
  hits
    .filter((hit) => hit.matched >= Math.min(MIN_MATCHED, hit.asked))
    .sort((a, b) => b.rank - a.rank || a.ruleId.localeCompare(b.ruleId))
    .slice(0, limit);

/** A rule id written in the question, so "what does R-SUB-004 say?" finds that rule however it is worded. */
export const namedRuleIds = (question: string): string[] => [
  ...new Set((question.toUpperCase().match(/R-[A-Z]{2,8}-\d{3}/g) ?? []).filter((id) => RULE_ID.test(id))),
];

/** Every version of each of these rules, read with the server's key. */
export async function versionsOfRules(admin: SupabaseClient, ruleIds: readonly string[]): Promise<RulebookEntry[]> {
  if (ruleIds.length === 0) return [];
  const { data, error } = await admin
    .from("rulebook_entries")
    .select(COLUMNS)
    .in("rule_id", [...ruleIds])
    .order("rule_id")
    .order("version");
  if (error) throw failed(error);
  return z.array(entryRow).parse(data ?? []).map(toEntry);
}

/**
 * The version of a rule this reader may be shown, with the hit that found it. Null when there is nothing: no
 * version this reader may see, or a rule that does not cover what was asked about (owner decision 12, the same
 * reading as the search's own SQL filter, applied again for a rule the question named by id).
 */
export function shownRule(
  versions: readonly RulebookEntry[],
  hit: SearchHit,
  reader: RuleReader,
  scope: AskScope = {},
): RetrievedRule | null {
  const { shown, newerDraft } = inForce(versions, reader);
  if (!shown || !inScope(shown, scope)) return null;
  return {
    ruleId: shown.ruleId,
    version: shown.version,
    title: shown.title,
    rule: shown.rule,
    body: shown.body,
    bestPractice: shown.bestPractice,
    scope: scopeLabel(shown),
    newerDraft: newerDraft ? NEWER_DRAFT_LINE : null,
    hit,
  };
}

/**
 * The two reads retrieval needs. The database holds both (`databaseRetrieval`); a test supplies its own, so no
 * test of the answering path or of the grader needs a database, and no test can reach a paid model through one.
 */
export type Retrieval = Readonly<{
  search: (question: string, scope: AskScope, limit: number) => Promise<SearchHit[]>;
  versions: (ruleIds: readonly string[]) => Promise<RulebookEntry[]>;
}>;

/** Retrieval against the real rulebook, with the server's key. */
export const databaseRetrieval = (admin: SupabaseClient): Retrieval => ({
  search: (question, scope, limit) => searchRulebook(admin, question, scope, limit),
  versions: (ruleIds) => versionsOfRules(admin, ruleIds),
});

/** The versions of every rule, grouped by rule id. */
export function byRule(entries: readonly RulebookEntry[]): Map<string, RulebookEntry[]> {
  const grouped = new Map<string, RulebookEntry[]>();
  for (const entry of entries) grouped.set(entry.ruleId, [...(grouped.get(entry.ruleId) ?? []), entry]);
  return grouped;
}

/**
 * The rules an answer to this question may draw on, best first: the shortlist of the search, plus any rule the
 * question names by id, each as the version this reader may see. A rule with nothing this reader may see is left
 * out, which is how a rulebook of drafts answers "not covered" to a member rather than reading a draft out.
 */
export async function retrieveRules(
  retrieval: Retrieval,
  question: string,
  scope: AskScope,
  reader: RuleReader,
  limit = MAX_RULES,
): Promise<RetrievedRule[]> {
  const hits = shortlist(await retrieval.search(question, scope, limit), limit);
  const named = namedRuleIds(question).filter((id) => !hits.some((hit) => hit.ruleId === id));
  const asked = hits[0]?.asked ?? 0;
  const all: SearchHit[] = [...hits, ...named.map((ruleId) => ({ ruleId, rank: 0, matched: asked, asked }))];
  const versions = byRule(await retrieval.versions(all.map((hit) => hit.ruleId)));
  return all.flatMap((hit) => {
    const rule = shownRule(versions.get(hit.ruleId) ?? [], hit, reader, scope);
    return rule ? [rule] : [];
  });
}
