import { z } from "zod";
import { RULE_ID, SOURCES, TOPICS } from "./types";

/**
 * What the rulebook editor sends. Every text is required except the source note and the article codes, which may
 * be empty (an empty list means the rule is shared by every article). Messages are in plain words.
 */

const text = (label: string, max: number) =>
  z.string().trim().min(1, `Write the ${label}.`).max(max, `The ${label} is too long.`);

/** Comma- or space-separated article codes, e.g. "JSY-SS-01, JSY-LS-01". */
export const parseArticleCodes = (raw: string): string[] =>
  [...new Set(raw.split(/[\s,]+/).map((code) => code.trim().toUpperCase()).filter((code) => code !== ""))];

const ARTICLE_CODE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

export const ruleInputSchema = z.object({
  ruleId: z.string().trim().toUpperCase().regex(RULE_ID, "Use the form R-SUB-004."),
  topic: z.enum(TOPICS, "Choose a topic."),
  articleCodes: z
    .string()
    .max(500, "That is too many article codes.")
    .default("")
    .transform(parseArticleCodes)
    .refine((codes) => codes.every((code) => ARTICLE_CODE.test(code)), "Article codes look like JSY-SS-01."),
  title: text("applies-to line", 300),
  rule: text("rule", 2000),
  body: text("why", 2000),
  bestPractice: text("best practice", 2000),
  source: z.enum(SOURCES, "Choose a source."),
  sourceNote: z.string().trim().max(500, "The source note is too long.").default(""),
});

export type RuleInput = z.output<typeof ruleInputSchema>;

export const confirmSchema = z.object({
  ruleId: z.string().trim().regex(RULE_ID, "Use the form R-SUB-004."),
  version: z.coerce.number().int().min(1),
});

export const explainSchema = z.object({
  ruleId: z.string().trim().min(1).max(40),
  context: z.string().max(500).default(""),
});
