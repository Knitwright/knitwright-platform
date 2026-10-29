import { z } from "zod";
import type { ArticleFabric, ArticlePom, BaseArticle, BaseArticleSummary, ConstructionStep, OptionDef, ParameterDef } from "./types";
import { ARTICLE_STATUSES, ARTICLE_USES, FABRIC_ROLES, GRADE_TYPES, PARAMETER_TYPES, PRODUCTION_CLASSES } from "./vocabulary";

/**
 * The database rows of the catalogue tables, checked with zod and turned into the catalogue's types. Rows come back
 * from PostgREST with numeric columns as JSON numbers and jsonb as parsed JSON.
 */

const ruleId = z.string().regex(/^R-[A-Z]{2,5}-\d{3}$/);
const texts = z.array(z.string());

export const pomRow = z.object({
  position: z.number().int(),
  letter: z.string(),
  code: z.string(),
  description: z.string(),
  grade_type: z.enum(GRADE_TYPES),
  grade_mm: z.number(),
  tol_minus_mm: z.number(),
  tol_plus_mm: z.number(),
  values_mm: z.record(z.string(), z.number()),
  rule_id: ruleId,
});

export const parameterRow = z.object({
  position: z.number().int(),
  key: z.string(),
  type: z.enum(PARAMETER_TYPES),
  min: z.number().nullable(),
  max: z.number().nullable(),
  step: z.number().nullable(),
  default_value: z.union([z.number(), z.string(), z.boolean()]),
  enum_values: texts.nullable(),
  unit: z.string().nullable(),
  affects_panels: texts,
  pom_letters: texts,
  rule_id: ruleId,
  approved_by_sample_id: z.uuid().nullable(),
});

export const optionRow = z.object({
  position: z.number().int(),
  option_group: z.string(),
  code: z.string(),
  label: z.string(),
  is_default: z.boolean(),
  thumbnail_key: z.string().nullable(),
  extra_cost_minor: z.number().int().nullable(),
  currency: z.string().nullable(),
  rule_id: ruleId,
  approved_by_sample_id: z.uuid().nullable(),
});

export const constructionRow = z.object({
  step: z.number().int(),
  seam: z.string(),
  operation: z.string(),
  iso_stitch_classes: texts,
  spi: z.string().nullable(),
  rule_id: ruleId,
});

export const fabricRow = z.object({
  position: z.number().int(),
  fabric_code: z.string(),
  role: z.enum(FABRIC_ROLES).nullable(),
  description: z.string().nullable(),
  gsm: z.string().nullable(),
  width_cm: z.number().nullable(),
  press_shrink_length_pct: z.number().nullable(),
  press_shrink_width_pct: z.number().nullable(),
  source_note: z.string().nullable(),
});

const summaryFields = {
  code: z.string(),
  name: z.string(),
  article_type: z.string(),
  production_class: z.enum(PRODUCTION_CLASSES),
  status: z.enum(ARTICLE_STATUSES),
  sport_tags: texts,
  uses: z.array(z.enum(ARTICLE_USES)),
  fit: z.string().nullable(),
  genders: texts,
  size_range: texts,
  sample_size: z.string().nullable(),
  registry_type_id: z.string().nullable(),
  data_label: z.string(),
};

export const summaryRow = z.object({ ...summaryFields, article_fabrics: z.array(fabricRow.pick({ position: true, fabric_code: true })) });

export const articleRow = z.object({
  ...summaryFields,
  hs_code: z.string().nullable(),
  origin: z.string().nullable(),
  source_version: z.string().nullable(),
  source_note: z.string().nullable(),
  glb_model_key: z.string().nullable(),
  uv_panel_map: z.record(z.string(), z.unknown()).nullable(),
  parametric_script_id: z.string().nullable(),
  parametric_script_version: z.string().nullable(),
  seam_allowances_mm: z.record(z.string(), z.number()).nullable(),
  seam_allowance_rule_id: ruleId.nullable(),
  thread_needle: z.string().nullable(),
  thread_looper: z.string().nullable(),
  thread_rule_id: ruleId.nullable(),
  article_poms: z.array(pomRow),
  parameter_defs: z.array(parameterRow),
  option_defs: z.array(optionRow),
  article_construction: z.array(constructionRow),
  article_fabrics: z.array(fabricRow),
});

export const SUMMARY_SELECT =
  "code, name, article_type, production_class, status, sport_tags, uses, fit, genders, size_range, sample_size, registry_type_id, data_label, article_fabrics(position, fabric_code)";

export const ARTICLE_SELECT = [
  "code, name, article_type, production_class, status, sport_tags, uses, fit, genders, size_range, sample_size, registry_type_id, data_label",
  "hs_code, origin, source_version, source_note, glb_model_key, uv_panel_map, parametric_script_id, parametric_script_version",
  "seam_allowances_mm, seam_allowance_rule_id, thread_needle, thread_looper, thread_rule_id",
  "article_poms(position, letter, code, description, grade_type, grade_mm, tol_minus_mm, tol_plus_mm, values_mm, rule_id)",
  "parameter_defs(position, key, type, min, max, step, default_value, enum_values, unit, affects_panels, pom_letters, rule_id, approved_by_sample_id)",
  "option_defs(position, option_group, code, label, is_default, thumbnail_key, extra_cost_minor, currency, rule_id, approved_by_sample_id)",
  "article_construction(step, seam, operation, iso_stitch_classes, spi, rule_id)",
  "article_fabrics(position, fabric_code, role, description, gsm, width_cm, press_shrink_length_pct, press_shrink_width_pct, source_note)",
].join(", ");

const byPosition = <T extends { position: number }>(rows: readonly T[]): readonly T[] => [...rows].sort((a, b) => a.position - b.position);

export const toPom = (row: z.infer<typeof pomRow>): ArticlePom => ({
  letter: row.letter,
  code: row.code,
  description: row.description,
  gradeType: row.grade_type,
  gradeMm: row.grade_mm,
  tolMinusMm: row.tol_minus_mm,
  tolPlusMm: row.tol_plus_mm,
  valuesMm: row.values_mm,
  ruleId: row.rule_id,
});

export const toParameter = (row: z.infer<typeof parameterRow>): ParameterDef => ({
  key: row.key,
  type: row.type,
  min: row.min,
  max: row.max,
  step: row.step,
  defaultValue: row.default_value,
  enumValues: row.enum_values,
  unit: row.unit,
  affectsPanels: row.affects_panels,
  pomLetters: row.pom_letters,
  ruleId: row.rule_id,
  approvedBySampleId: row.approved_by_sample_id,
});

export const toOption = (row: z.infer<typeof optionRow>): OptionDef => ({
  group: row.option_group,
  code: row.code,
  label: row.label,
  isDefault: row.is_default,
  thumbnailKey: row.thumbnail_key,
  extraCostMinor: row.extra_cost_minor,
  currency: row.currency,
  ruleId: row.rule_id,
  approvedBySampleId: row.approved_by_sample_id,
});

const toConstruction = (row: z.infer<typeof constructionRow>): ConstructionStep => ({
  step: row.step,
  seam: row.seam,
  operation: row.operation,
  isoStitchClasses: row.iso_stitch_classes,
  spi: row.spi,
  ruleId: row.rule_id,
});

const toFabric = (row: z.infer<typeof fabricRow>): ArticleFabric => ({
  code: row.fabric_code,
  role: row.role,
  description: row.description,
  gsm: row.gsm,
  widthCm: row.width_cm,
  pressShrinkLengthPct: row.press_shrink_length_pct,
  pressShrinkWidthPct: row.press_shrink_width_pct,
  sourceNote: row.source_note,
});

type SummaryFields = Omit<BaseArticleSummary, "fabricCodes">;

const summaryOf = (row: z.infer<typeof summaryRow> | z.infer<typeof articleRow>): SummaryFields => ({
  code: row.code,
  name: row.name,
  articleType: row.article_type,
  productionClass: row.production_class,
  status: row.status,
  sportTags: row.sport_tags,
  uses: row.uses,
  fit: row.fit,
  genders: row.genders,
  sizeRange: row.size_range,
  sampleSize: row.sample_size,
  registryTypeId: row.registry_type_id,
  dataLabel: row.data_label,
});

export const toSummary = (row: z.infer<typeof summaryRow>): BaseArticleSummary => ({
  ...summaryOf(row),
  fabricCodes: byPosition(row.article_fabrics).map((fabric) => fabric.fabric_code),
});

export function toArticle(row: z.infer<typeof articleRow>): BaseArticle {
  return {
    ...summaryOf(row),
    hsCode: row.hs_code,
    origin: row.origin,
    sourceVersion: row.source_version,
    sourceNote: row.source_note,
    glbModelKey: row.glb_model_key,
    uvPanelMap: row.uv_panel_map,
    parametricScriptId: row.parametric_script_id,
    parametricScriptVersion: row.parametric_script_version,
    seamAllowances: row.seam_allowances_mm && row.seam_allowance_rule_id ? { mm: row.seam_allowances_mm, ruleId: row.seam_allowance_rule_id } : null,
    thread:
      row.thread_needle && row.thread_looper && row.thread_rule_id
        ? { needle: row.thread_needle, looper: row.thread_looper, ruleId: row.thread_rule_id }
        : null,
    poms: byPosition(row.article_poms).map(toPom),
    parameters: byPosition(row.parameter_defs).map(toParameter),
    options: byPosition(row.option_defs).map(toOption),
    construction: [...row.article_construction].sort((a, b) => a.step - b.step).map(toConstruction),
    fabrics: byPosition(row.article_fabrics).map(toFabric),
  };
}
