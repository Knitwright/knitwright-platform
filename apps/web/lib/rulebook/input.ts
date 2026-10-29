import { z } from "zod";
import { misfiledAsFactory } from "./sources";
import { RULE_ID, SOURCES, TOPICS } from "./types";

/**
 * What the rulebook editor sends. Every text is required except the two notes. A rule names the articles it
 * covers or the methods it covers, and at least one of the two: owner decision 12 says a rule reaches as far as
 * its source and no further, so nothing saved here can claim every article. Messages are in plain words.
 */

const text = (label: string, max: number) =>
  z.string().trim().min(1, `Write the ${label}.`).max(max, `The ${label} is too long.`);

/** Comma- or space-separated article codes, e.g. "JSY-SS-01, JSY-LS-01". */
export const parseArticleCodes = (raw: string): string[] =>
  [...new Set(raw.split(/[\s,]+/).map((code) => code.trim().toUpperCase()).filter((code) => code !== ""))];

const ARTICLE_CODE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

/** Comma- or space-separated method names, e.g. "sublimation". A method name is a lowercase id. */
export const parseMethods = (raw: string): string[] =>
  [...new Set(raw.split(/[\s,]+/).map((method) => method.trim().toLowerCase()).filter((method) => method !== ""))];

const METHOD = /^[a-z][a-z0-9_]*$/;

export const ruleInputSchema = z.object({
  ruleId: z.string().trim().toUpperCase().regex(RULE_ID, "Use the form R-SUB-004."),
  topic: z.enum(TOPICS, "Choose a topic."),
  articleCodes: z
    .string()
    .max(500, "That is too many article codes.")
    .default("")
    .transform(parseArticleCodes)
    .refine((codes) => codes.every((code) => ARTICLE_CODE.test(code)), "Article codes look like JSY-SS-01."),
  // Owner decision 12: a rule reaches as far as its source, so it names the articles or the methods it covers.
  methods: z
    .string()
    .max(200, "That is too many methods.")
    .default("")
    .transform(parseMethods)
    .refine((methods) => methods.every((method) => METHOD.test(method)), "A method looks like sublimation."),
  scopeNote: z.string().trim().max(300, "The scope note is too long.").default(""),
  title: text("applies-to line", 300),
  rule: text("rule", 2000),
  body: text("why", 2000),
  bestPractice: text("best practice", 2000),
  source: z.enum(SOURCES, "Choose a source."),
  sourceNote: z.string().trim().max(500, "The source note is too long.").default(""),
})
  .refine((input) => input.articleCodes.length > 0 || input.methods.length > 0, {
    message: "Name the articles or the methods this rule covers.",
    path: ["articleCodes"],
  })
  // Owner decision 13: filing a note that only asks the factory for something as the factory's word implies a
  // sign-off nobody gave.
  .refine((input) => !misfiledAsFactory(input), {
    message: "That note does not say the factory told us this. File it under whoever did.",
    path: ["source"],
  });

export type RuleInput = z.output<typeof ruleInputSchema>;

/** Owner decision 14: a confirmation names the factory person who reviewed the rule, and their role. */
export const confirmSchema = z.object({
  ruleId: z.string().trim().regex(RULE_ID, "Use the form R-SUB-004."),
  version: z.coerce.number().int().min(1),
  confirmedName: text("name of the factory person who reviewed the rule", 120),
  confirmedRole: text("role of the factory person, for example pattern master", 120),
});

export type ConfirmInput = z.output<typeof confirmSchema>;

export const explainSchema = z.object({
  ruleId: z.string().trim().min(1).max(40),
  context: z.string().max(500).default(""),
});
