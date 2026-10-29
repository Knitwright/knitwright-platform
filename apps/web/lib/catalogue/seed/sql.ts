import type { BaseArticle } from "../types";

/**
 * Writes the seed of the base article catalogue as SQL, for the migration 20261101010000_base_articles.sql. The
 * migration holds this text between its seed markers, and `sql.test.ts` checks that it still matches what
 * `launchCatalogue(article.json)` gives, so the database seed cannot drift from the build pack's file.
 */

export type SqlValue = string | number | boolean | null | readonly string[] | Readonly<Record<string, unknown>>;

const quote = (text: string): string => `'${text.replaceAll("'", "''")}'`;

const arrayLiteral = (items: readonly string[]): string =>
  quote(`{${items.map((item) => `"${item.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`).join(",")}}`);

/** One value as a SQL literal. Arrays become text arrays, objects jsonb. */
export function literal(value: SqlValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return quote(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Not a number the seed can store: ${value}`);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return arrayLiteral(value as readonly string[]);
  return `${quote(JSON.stringify(value))}::jsonb`;
}

const insert = (table: string, columns: readonly string[], rows: readonly (readonly string[])[]): string =>
  rows.length === 0
    ? ""
    : `insert into public.${table} (${columns.join(", ")}) values\n${rows.map((row) => `  (${row.join(", ")})`).join(",\n")};\n`;

const articleId = (code: string): string => `(select id from public.base_articles where code = ${quote(code)})`;

const ARTICLE_COLUMNS = [
  "code", "name", "article_type", "production_class", "status", "sport_tags", "uses", "fit", "genders", "size_range",
  "sample_size", "registry_type_id", "data_label", "hs_code", "origin", "source_version", "source_note", "glb_model_key",
  "uv_panel_map", "parametric_script_id", "parametric_script_version", "seam_allowances_mm", "seam_allowance_rule_id",
  "thread_needle", "thread_looper", "thread_rule_id",
] as const;

const articleRow = (a: BaseArticle): readonly string[] =>
  [
    a.code, a.name, a.articleType, a.productionClass, a.status, a.sportTags, a.uses, a.fit, a.genders, a.sizeRange,
    a.sampleSize, a.registryTypeId, a.dataLabel, a.hsCode, a.origin, a.sourceVersion, a.sourceNote, a.glbModelKey,
    (a.uvPanelMap ?? null) as SqlValue, a.parametricScriptId, a.parametricScriptVersion, a.seamAllowances?.mm ?? null,
    a.seamAllowances?.ruleId ?? null, a.thread?.needle ?? null, a.thread?.looper ?? null, a.thread?.ruleId ?? null,
  ].map(literal);

const POM_COLUMNS = ["article_id", "position", "letter", "code", "description", "grade_type", "grade_mm", "tol_minus_mm", "tol_plus_mm", "values_mm", "rule_id"];
const pomRows = (a: BaseArticle): readonly string[][] =>
  a.poms.map((p, i) => [
    articleId(a.code),
    ...[i, p.letter, p.code, p.description, p.gradeType, p.gradeMm, p.tolMinusMm, p.tolPlusMm, p.valuesMm, p.ruleId].map(literal),
  ]);

const PARAMETER_COLUMNS = [
  "article_id", "position", "key", "type", "min", "max", "step", "default_value", "enum_values", "unit", "affects_panels",
  "pom_letters", "rule_id", "approved_by_sample_id",
];
const parameterRows = (a: BaseArticle): readonly string[][] =>
  a.parameters.map((p, i) => [
    articleId(a.code),
    ...[i, p.key, p.type, p.min, p.max, p.step].map(literal),
    `${quote(JSON.stringify(p.defaultValue))}::jsonb`,
    ...[p.enumValues, p.unit, p.affectsPanels, p.pomLetters, p.ruleId, p.approvedBySampleId].map(literal),
  ]);

const OPTION_COLUMNS = [
  "article_id", "position", "option_group", "code", "label", "is_default", "thumbnail_key", "extra_cost_minor", "currency",
  "rule_id", "approved_by_sample_id",
];
const optionRows = (a: BaseArticle): readonly string[][] =>
  a.options.map((o, i) => [
    articleId(a.code),
    ...[i, o.group, o.code, o.label, o.isDefault, o.thumbnailKey, o.extraCostMinor, o.currency, o.ruleId, o.approvedBySampleId].map(literal),
  ]);

const CONSTRUCTION_COLUMNS = ["article_id", "step", "seam", "operation", "iso_stitch_classes", "spi", "rule_id"];
const constructionRows = (a: BaseArticle): readonly string[][] =>
  a.construction.map((c) => [articleId(a.code), ...[c.step, c.seam, c.operation, c.isoStitchClasses, c.spi, c.ruleId].map(literal)]);

const FABRIC_COLUMNS = [
  "article_id", "position", "fabric_code", "role", "description", "gsm", "width_cm", "press_shrink_length_pct",
  "press_shrink_width_pct", "source_note",
];
const fabricRows = (a: BaseArticle): readonly string[][] =>
  a.fabrics.map((f, i) => [
    articleId(a.code),
    ...[i, f.code, f.role, f.description, f.gsm, f.widthCm, f.pressShrinkLengthPct, f.pressShrinkWidthPct, f.sourceNote].map(literal),
  ]);

/** The seed statements for these articles, in a fixed order, so the same catalogue always gives the same text. */
export function seedSql(articles: readonly BaseArticle[]): string {
  return [
    insert("base_articles", ARTICLE_COLUMNS, articles.map(articleRow)),
    insert("article_poms", POM_COLUMNS, articles.flatMap(pomRows)),
    insert("parameter_defs", PARAMETER_COLUMNS, articles.flatMap(parameterRows)),
    insert("option_defs", OPTION_COLUMNS, articles.flatMap(optionRows)),
    insert("article_construction", CONSTRUCTION_COLUMNS, articles.flatMap(constructionRows)),
    insert("article_fabrics", FABRIC_COLUMNS, articles.flatMap(fabricRows)),
  ]
    .filter((statement) => statement !== "")
    .join("\n");
}

export const SEED_BEGIN = "-- BEGIN GENERATED SEED (lib/catalogue/seed/sql.ts; do not edit by hand)";
export const SEED_END = "-- END GENERATED SEED";

/** The seed text a migration holds between the markers, or undefined when it has none. */
export function seedBlockOf(migration: string): string | undefined {
  const start = migration.indexOf(SEED_BEGIN);
  const end = migration.indexOf(SEED_END);
  if (start < 0 || end < start) return undefined;
  return migration.slice(start + SEED_BEGIN.length + 1, end);
}
