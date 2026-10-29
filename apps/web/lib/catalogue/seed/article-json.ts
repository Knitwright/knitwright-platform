import { z } from "zod";
import { registryTypeForBaseArticle } from "../registry-map";
import type { ArticleFabric, ArticlePom, BaseArticle, ConstructionStep, OptionDef, ParameterDef } from "../types";
import { ARTICLE_USES, articleTypeOf, DRAFT_LABEL, FABRIC_ROLES, GRADE_TYPES, PRODUCTION_CLASSES, RULE_GAP } from "../vocabulary";

/**
 * Reads a base article's `article.json` (the build pack format, docs/spec/articles/<CODE>/article.json) into the
 * catalogue's shape, value for value. Only what the catalogue stores is read; the rest of the file (BOM, print,
 * placements, labels, QC) belongs to other workstreams. Nothing is added: a value the file does not hold stays null.
 */

const rule = z.string().regex(/^R-[A-Z]{2,5}-\d{3}$/);

const pomSchema = z.object({
  letter: z.string(),
  code: z.string(),
  description: z.string(),
  grade_type: z.enum(GRADE_TYPES),
  grade: z.number(),
  tol: z.number(),
  rule,
  values: z.record(z.string(), z.number()),
});

const parameterSchema = z.object({
  key: z.string(),
  type: z.literal("range"),
  min: z.number(),
  max: z.number(),
  step: z.number(),
  default: z.number(),
  affects: z.array(z.string()),
  pom: z.array(z.string()),
  rule,
  approved: z.boolean(),
});

const optionSchema = z.object({ code: z.string(), name: z.string(), default: z.boolean().optional(), rule: rule.optional() });

const fabricSchema = z.object({
  code: z.string(),
  description: z.string(),
  gsm: z.string(),
  width_cm: z.number().optional(),
  press_shrink_length_pct: z.number().optional(),
  press_shrink_width_pct: z.number().optional(),
  status: z.string(),
});

const constructionSchema = z.object({ n: z.number().int(), seam: z.string(), operation: z.string(), spi: z.string(), rule });

export const articleJsonSchema = z.object({
  code: z.string(),
  name: z.string(),
  version: z.string(),
  class: z.enum(PRODUCTION_CLASSES),
  uses: z.array(z.enum(ARTICLE_USES)),
  sports: z.array(z.string()),
  hs_code: z.string(),
  origin: z.string().length(2),
  base_size: z.string(),
  sizes: z.array(z.string()).min(1),
  units: z.literal("mm"),
  note: z.string(),
  fabrics: z.partialRecord(z.enum(FABRIC_ROLES), fabricSchema),
  pom: z.array(pomSchema),
  parameters: z.array(parameterSchema),
  options: z.record(z.string(), z.array(optionSchema)),
  seam_allowance: z.record(z.string(), z.union([z.number(), z.string()])),
  construction: z.array(constructionSchema),
  thread: z.object({ needle: z.string(), looper: z.string(), rule }),
});

export type ArticleJson = z.infer<typeof articleJsonSchema>;

/** What the file does not say and the catalogue needs: read from the article's name, never guessed. */
export type ArticleJsonExtras = Readonly<{ fit: string | null; genders: readonly string[] }>;

const toPom = (pom: ArticleJson["pom"][number]): ArticlePom => ({
  letter: pom.letter,
  code: pom.code,
  description: pom.description,
  gradeType: pom.grade_type,
  gradeMm: pom.grade,
  // The file gives one tolerance, plus or minus.
  tolMinusMm: pom.tol,
  tolPlusMm: pom.tol,
  valuesMm: { ...pom.values },
  ruleId: pom.rule,
});

const toParameter = (parameter: ArticleJson["parameters"][number]): ParameterDef => ({
  key: parameter.key,
  type: parameter.type,
  min: parameter.min,
  max: parameter.max,
  step: parameter.step,
  defaultValue: parameter.default,
  enumValues: null,
  unit: "mm",
  affectsPanels: [...parameter.affects],
  pomLetters: [...parameter.pom],
  ruleId: parameter.rule,
  // The file's `approved: false` is "no sample yet". A true would need the sample's id, which the file cannot give.
  approvedBySampleId: null,
});

const toOptions = (options: ArticleJson["options"]): readonly OptionDef[] =>
  Object.entries(options).flatMap(([group, list]) =>
    list.map((option) => ({
      group,
      code: option.code,
      label: option.name,
      isDefault: option.default === true,
      thumbnailKey: null,
      extraCostMinor: null,
      currency: null,
      // No rule in the file means no rulebook entry yet, which is R-GAP-000, not nothing.
      ruleId: option.rule ?? RULE_GAP,
      approvedBySampleId: null,
    })),
  );

/** The ISO 4915 stitch classes an operation names, as written ("ISO 514" gives "514"), in order, once each. */
export const isoStitchClasses = (operation: string): readonly string[] => [
  ...new Set([...operation.matchAll(/ISO (\d{3})\b/g)].map((match) => match[1]!)),
];

const toConstruction = (row: ArticleJson["construction"][number]): ConstructionStep => ({
  step: row.n,
  seam: row.seam,
  operation: row.operation,
  isoStitchClasses: isoStitchClasses(row.operation),
  spi: row.spi === "" ? null : row.spi,
  ruleId: row.rule,
});

const toFabrics = (fabrics: ArticleJson["fabrics"]): readonly ArticleFabric[] =>
  FABRIC_ROLES.flatMap((role) => {
    const fabric = fabrics[role];
    if (!fabric) return [];
    return [
      {
        code: fabric.code,
        role,
        description: fabric.description,
        gsm: fabric.gsm,
        widthCm: fabric.width_cm ?? null,
        pressShrinkLengthPct: fabric.press_shrink_length_pct ?? null,
        pressShrinkWidthPct: fabric.press_shrink_width_pct ?? null,
        sourceNote: fabric.status,
      },
    ];
  });

const seamAllowances = (allowance: ArticleJson["seam_allowance"]): BaseArticle["seamAllowances"] => {
  const mm = Object.fromEntries(Object.entries(allowance).filter((entry): entry is [string, number] => typeof entry[1] === "number"));
  return { mm, ruleId: rule.parse(allowance.rule) };
};

/** The catalogue article an `article.json` describes, labelled as Knitwright's unreviewed draft. */
export function baseArticleFromJson(input: unknown, extras: ArticleJsonExtras): BaseArticle {
  const json = articleJsonSchema.parse(input);
  return {
    code: json.code,
    name: json.name,
    articleType: articleTypeOf(json.code),
    productionClass: json.class,
    status: "draft",
    sportTags: [...json.sports],
    uses: [...json.uses],
    fit: extras.fit,
    genders: [...extras.genders],
    sizeRange: [...json.sizes],
    sampleSize: json.base_size,
    registryTypeId: registryTypeForBaseArticle(json.code),
    dataLabel: DRAFT_LABEL,
    hsCode: json.hs_code,
    origin: json.origin,
    sourceVersion: json.version,
    sourceNote: json.note,
    glbModelKey: null,
    uvPanelMap: null,
    parametricScriptId: null,
    parametricScriptVersion: null,
    seamAllowances: seamAllowances(json.seam_allowance),
    thread: { needle: json.thread.needle, looper: json.thread.looper, ruleId: json.thread.rule },
    poms: json.pom.map(toPom),
    parameters: json.parameters.map(toParameter),
    options: toOptions(json.options),
    construction: json.construction.map(toConstruction),
    fabrics: toFabrics(json.fabrics),
  };
}
