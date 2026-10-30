import { z } from "zod";
import { registryTypeForBaseArticle } from "../registry-map";
import type { ArticleFabric, BaseArticle } from "../types";
import { ARTICLE_CODE, ARTICLE_USES, articleTypeOf, DRAFT_LABEL, FABRIC_CODE, FABRIC_ROLES, RULE_ID } from "../vocabulary";
import bundled from "./data/draft-articles.json";

/**
 * Reads the brief of a launch article that has no factory block yet (plan v5 workstream Z9, decision 0090):
 * `docs/spec/articles/<CODE>/article.json` in its draft shape. A brief holds only values it cites in its own
 * `sources` list; everything the build pack does not publish is empty, and what the build pack publishes as
 * illustrative, an example or a placeholder stays in `candidates`, which the catalogue never reads.
 *
 * The seven points of measure tables are empty on purpose. Nothing published measures these garments, so an empty
 * table is the correct state (ONBOARDING.md step 2) and a filled one would be an invented measurement.
 */

/** The seven launch articles with no factory block, in the order of ONBOARDING.md. */
export const DRAFT_CODES = [
  "SHO-TR-01",
  "JSY-LS-01",
  "CRK-SS-01",
  "TEE-TR-01",
  "HOD-ST-01",
  "CMP-LS-01",
  "FSH-MM-01",
] as const;

/** The words plan v5 requires on every value of these briefs. The catalogue's own label says the same with a version. */
export const BRIEF_LABEL = "Knitwright draft, not reviewed by a factory";

/** What a brief says in place of a drafting script, until a factory block exists. */
export const NOT_DRAFTED_YET = "not drafted yet";

const citation = z.object({ field: z.string().min(1), value: z.string().min(1), source: z.string().min(1) });

/** A value the build pack publishes as illustrative, an example or a placeholder: cited, caveated, and not the article. */
const candidate = z.object({
  kind: z.enum(["pom", "size_range", "parameter", "option", "fabric", "construction", "sport", "tolerance"]),
  field: z.string().min(1),
  value: z.string().min(1),
  source: z.string().min(1),
  caveat: z.string().min(1),
});

/** A table this brief cannot hold: a filled one is read by `article-json.ts`, which checks every row and its rule. */
const empty = z.array(z.unknown()).max(0);

export const draftArticleSchema = z.object({
  code: z.string().regex(ARTICLE_CODE),
  name: z.string().min(1),
  status: z.literal("draft_no_factory_block"),
  version: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.literal(BRIEF_LABEL),
  class: z.enum(["A", "B"]),
  uses: z.array(z.enum(ARTICLE_USES)).min(1),
  sports: z.array(z.string().min(1)),
  hs_code: z.string().nullable(),
  origin: z.string().length(2).nullable(),
  base_size: z.string().nullable(),
  sizes: z.array(z.string().min(1)),
  units: z.literal("mm"),
  note: z.string().min(1),
  fabrics: z.partialRecord(z.enum(FABRIC_ROLES), z.object({ code: z.string().regex(FABRIC_CODE) })),
  pom: empty,
  parameters: empty,
  options: z.record(z.string(), z.array(z.unknown()).max(0)),
  construction: empty,
  parametric_script: z.object({
    status: z.literal(NOT_DRAFTED_YET),
    reason: z.string().min(1),
    rule: z.string().regex(RULE_ID),
    /** The points of measure a drafter would need, so the gap is a list rather than a shrug. */
    needs: z.array(z.string().min(1)).min(1),
  }),
  sources: z.array(citation).min(1),
  candidates: z.array(candidate),
  open_questions: z.array(z.string().min(1)).min(1),
});

export type DraftArticleJson = z.output<typeof draftArticleSchema>;

const fabricsOf = (draft: DraftArticleJson): readonly ArticleFabric[] =>
  FABRIC_ROLES.flatMap((role) => {
    const fabric = draft.fabrics[role];
    // The launch catalogue names the programme code; the blend and the weight are the build pack's own
    // placeholders, so they stay in `candidates` and the row holds the code alone (decision 0066, point 2).
    return fabric
      ? [{ code: fabric.code, role: null, description: null, gsm: null, widthCm: null, pressShrinkLengthPct: null, pressShrinkWidthPct: null, sourceNote: null }]
      : [];
  });

/** The field paths of a brief that hold a value and so need a citation. An empty or null field needs none. */
export function citedFields(draft: DraftArticleJson): readonly string[] {
  const always = ["code", "name", "class", "uses", "units"];
  const whenGiven: readonly [string, unknown][] = [
    ["sports", draft.sports.length > 0 ? draft.sports : null],
    ["sizes", draft.sizes.length > 0 ? draft.sizes : null],
    ["base_size", draft.base_size],
    ["hs_code", draft.hs_code],
    ["origin", draft.origin],
  ];
  return [
    ...always,
    ...whenGiven.filter(([, value]) => value !== null).map(([field]) => field),
    ...Object.keys(draft.fabrics).map((role) => `fabrics.${role}.code`),
  ];
}

/** The values of a brief with no citation behind them. Empty means every value in the file says where it came from. */
export function uncitedFields(draft: DraftArticleJson): readonly string[] {
  const cited = new Set(draft.sources.map((source) => source.field));
  return citedFields(draft).filter((field) => !cited.has(field));
}

/**
 * The catalogue article a brief describes. Nothing is added: the measures, ranges, options and construction are
 * empty because the brief's are, and the fit, gender, HS code and version the build pack does not publish stay null.
 */
export function baseArticleFromDraftJson(draft: DraftArticleJson): BaseArticle {
  return {
    code: draft.code,
    name: draft.name,
    articleType: articleTypeOf(draft.code),
    productionClass: draft.class,
    status: "draft",
    sportTags: [...draft.sports],
    uses: [...draft.uses],
    fit: null,
    genders: [],
    sizeRange: [...draft.sizes],
    sampleSize: draft.base_size,
    registryTypeId: registryTypeForBaseArticle(draft.code),
    dataLabel: DRAFT_LABEL,
    hsCode: draft.hs_code,
    origin: draft.origin,
    // The brief's own version and note describe a file with no article data in it yet, so the catalogue row carries
    // neither: there is nothing to version. They arrive with the factory's values, and with them a reseed migration.
    sourceVersion: null,
    sourceNote: null,
    glbModelKey: null,
    uvPanelMap: null,
    parametricScriptId: null,
    parametricScriptVersion: null,
    seamAllowances: null,
    thread: null,
    poms: [],
    parameters: [],
    options: [],
    construction: [],
    fabrics: fabricsOf(draft),
  };
}

const bundleSchema = z.object({ note: z.string().min(1), articles: z.array(draftArticleSchema).min(1) });

/**
 * The briefs committed in docs/spec/articles, copied into this directory by `print-draft-articles.mts` because
 * nothing in this package imports from outside it. A test keeps each copy equal to its original.
 */
export const BUNDLED_DRAFT_ARTICLES: readonly DraftArticleJson[] = bundleSchema.parse(bundled).articles;

export const draftArticleByCode = (code: string): DraftArticleJson | null =>
  BUNDLED_DRAFT_ARTICLES.find((draft) => draft.code === code) ?? null;
