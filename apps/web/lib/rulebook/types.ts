import { z } from "zod";
import { SOURCES, STATUSES, TOPICS, type RulebookEntry } from "./constants";

export * from "./constants";

/**
 * The rulebook behind every "Why?" (spec F-S5 v1, decision 0067). One row of `rulebook_entries` is one version of one
 * rule. A rule is never overwritten: an edit adds the next version, and the newest version is the one shown.
 */

export const entryRow = z.object({
  id: z.string(),
  rule_id: z.string(),
  version: z.number().int().min(1),
  topic: z.enum(TOPICS).nullable(),
  article_codes: z.array(z.string()),
  title: z.string(),
  rule: z.string(),
  body: z.string(),
  best_practice: z.string(),
  source: z.enum(SOURCES),
  source_note: z.string(),
  status: z.enum(STATUSES),
  // Only the server's key reads who confirmed a rule; a member's read leaves the column out.
  confirmed_by: z.string().nullish(),
  confirmed_at: z.string().nullable(),
  created_at: z.string(),
});
export type EntryRow = z.infer<typeof entryRow>;

export const toEntry = (row: EntryRow): RulebookEntry => ({
  id: row.id,
  ruleId: row.rule_id,
  version: row.version,
  topic: row.topic,
  articleCodes: row.article_codes,
  title: row.title,
  rule: row.rule,
  body: row.body,
  bestPractice: row.best_practice,
  source: row.source,
  sourceNote: row.source_note,
  status: row.status,
  confirmedBy: row.confirmed_by ?? null,
  confirmedAt: row.confirmed_at,
  createdAt: row.created_at,
});

export const gapRow = z.object({
  code: z.string(),
  context: z.string(),
  count: z.number().int(),
  first_seen: z.string(),
  last_seen: z.string(),
});

/** A question or check code with no rulebook entry, counted each time someone meets it. */
export type RulebookGap = Readonly<{ code: string; context: string; count: number; firstSeen: string; lastSeen: string }>;
