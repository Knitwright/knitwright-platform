import { readFileSync } from "node:fs";
import { join } from "node:path";
import { launchCatalogue } from "../seed/launch";
import type { BaseArticle } from "../types";

/** The repository root, from apps/web/lib/catalogue/fixtures. */
export const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

/** The build pack's worked article, as parsed JSON. Tests read it; the app never does. */
export const readArticleJson = (): Record<string, unknown> =>
  JSON.parse(readFileSync(join(REPO_ROOT, "docs", "spec", "articles", "JSY-SS-01", "article.json"), "utf8")) as Record<string, unknown>;

export const readOnboarding = (): string => readFileSync(join(REPO_ROOT, "docs", "spec", "articles", "ONBOARDING.md"), "utf8");

export const readMigration = (): string =>
  readFileSync(join(REPO_ROOT, "supabase", "migrations", "20261101010000_base_articles.sql"), "utf8");

export const catalogue = (): readonly BaseArticle[] => launchCatalogue(readArticleJson());

/** The rows PostgREST would send for an article, built back from the catalogue's shape. */
export function rowOf(article: BaseArticle): Record<string, unknown> {
  return {
    code: article.code,
    name: article.name,
    article_type: article.articleType,
    production_class: article.productionClass,
    status: article.status,
    sport_tags: article.sportTags,
    uses: article.uses,
    fit: article.fit,
    genders: article.genders,
    size_range: article.sizeRange,
    sample_size: article.sampleSize,
    registry_type_id: article.registryTypeId,
    data_label: article.dataLabel,
    hs_code: article.hsCode,
    origin: article.origin,
    source_version: article.sourceVersion,
    source_note: article.sourceNote,
    glb_model_key: article.glbModelKey,
    uv_panel_map: article.uvPanelMap,
    parametric_script_id: article.parametricScriptId,
    parametric_script_version: article.parametricScriptVersion,
    seam_allowances_mm: article.seamAllowances?.mm ?? null,
    seam_allowance_rule_id: article.seamAllowances?.ruleId ?? null,
    thread_needle: article.thread?.needle ?? null,
    thread_looper: article.thread?.looper ?? null,
    thread_rule_id: article.thread?.ruleId ?? null,
    // Reversed, so the reader has to put them back in order.
    article_poms: article.poms.map((p, position) => ({
      position, letter: p.letter, code: p.code, description: p.description, grade_type: p.gradeType, grade_mm: p.gradeMm,
      tol_minus_mm: p.tolMinusMm, tol_plus_mm: p.tolPlusMm, values_mm: p.valuesMm, rule_id: p.ruleId,
    })).reverse(),
    parameter_defs: article.parameters.map((p, position) => parameterRowOf(p, position)).reverse(),
    option_defs: article.options.map((o, position) => optionRowOf(o, position)).reverse(),
    article_construction: article.construction.map((c) => ({
      step: c.step, seam: c.seam, operation: c.operation, iso_stitch_classes: c.isoStitchClasses, spi: c.spi, rule_id: c.ruleId,
    })).reverse(),
    article_fabrics: article.fabrics.map((f, position) => ({
      position, fabric_code: f.code, role: f.role, description: f.description, gsm: f.gsm, width_cm: f.widthCm,
      press_shrink_length_pct: f.pressShrinkLengthPct, press_shrink_width_pct: f.pressShrinkWidthPct, source_note: f.sourceNote,
    })).reverse(),
  };
}

export const parameterRowOf = (p: BaseArticle["parameters"][number], position: number): Record<string, unknown> => ({
  position, key: p.key, type: p.type, min: p.min, max: p.max, step: p.step, default_value: p.defaultValue,
  enum_values: p.enumValues, unit: p.unit, affects_panels: p.affectsPanels, pom_letters: p.pomLetters, rule_id: p.ruleId,
  approved_by_sample_id: p.approvedBySampleId,
});

export const optionRowOf = (o: BaseArticle["options"][number], position: number): Record<string, unknown> => ({
  position, option_group: o.group, code: o.code, label: o.label, is_default: o.isDefault, thumbnail_key: o.thumbnailKey,
  extra_cost_minor: o.extraCostMinor, currency: o.currency, rule_id: o.ruleId, approved_by_sample_id: o.approvedBySampleId,
});
