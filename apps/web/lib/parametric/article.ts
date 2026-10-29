import { z } from "zod";
import jsySs01 from "./data/JSY-SS-01.json";

/**
 * The part of a base article's `article.json` (docs/spec/articles/<code>/article.json) that the
 * drafter reads. Unknown fields are kept out; a field the drafter needs and the file lacks fails
 * the parse instead of being guessed.
 */

const ruleId = z.string().regex(/^R-[A-Z]+-\d{3}$/);
const mm = z.number().finite();

const pomSchema = z.object({
  letter: z.string().regex(/^[A-Z]$/),
  code: z.string(),
  description: z.string(),
  rule: ruleId,
  values: z.record(z.string(), mm),
});

const parameterSchema = z.object({
  key: z.string().regex(/^[a-z_]+$/),
  type: z.literal("range"),
  min: mm,
  max: mm,
  step: z.number().positive(),
  default: mm,
  pom: z.array(z.string()),
  rule: ruleId,
  approved: z.boolean(),
});

const optionSchema = z.object({
  code: z.string().regex(/^[A-Z]\d{2}$/),
  name: z.string(),
  default: z.boolean().optional(),
  rule: ruleId.optional(),
});

export const articleDefinitionSchema = z.object({
  code: z.string().regex(/^[A-Z]{3}-[A-Z]{2}-\d{2}$/),
  version: z.string(),
  base_size: z.string(),
  sizes: z.array(z.string()).min(1),
  fabrics: z.object({ body: z.object({ code: z.string() }), rib: z.object({ code: z.string() }) }),
  pom: z.array(pomSchema),
  draft_constants: z.object({
    shoulder_slope: mm,
    rib_ratio: z.number().positive(),
    sleeve_cap_ease_target: z.tuple([mm, mm]),
  }),
  parameters: z.array(parameterSchema),
  options: z.record(z.string(), z.array(optionSchema)),
  seam_allowance: z.object({
    shoulder: mm,
    side: mm,
    armhole: mm,
    sleeve_underarm: mm,
    neck: mm,
    body_hem: mm,
    sleeve_hem: mm,
    rib: mm,
    rule: ruleId,
  }),
});
export type ArticleDefinition = z.output<typeof articleDefinitionSchema>;
export type ArticleParameter = ArticleDefinition["parameters"][number];

/**
 * Where the drafter gets an article from. The base article catalogue (plan v5, X1) will supply a
 * database-backed source; until then the articles committed with the spec are bundled.
 */
export interface ArticleSource {
  get(code: string): ArticleDefinition | null;
}

/** A source over a fixed list of articles. */
export function articleSource(articles: readonly ArticleDefinition[]): ArticleSource {
  const byCode = new Map(articles.map((a) => [a.code, a]));
  return { get: (code) => byCode.get(code) ?? null };
}

/** The articles committed in docs/spec/articles, copied into this directory (a test keeps them equal). */
export const BUNDLED_ARTICLES: ArticleSource = articleSource([articleDefinitionSchema.parse(jsySs01)]);

/** A point-of-measure value, or null when the article has no value for that letter and size. */
export function pomValue(article: ArticleDefinition, letter: string, size: string): number | null {
  const row = article.pom.find((p) => p.letter === letter);
  if (!row || !Object.hasOwn(row.values, size)) return null;
  return row.values[size];
}
