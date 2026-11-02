import { literal } from "@/lib/catalogue/seed/sql";
import type { OptionCodeMapping } from "../types";

/**
 * Writes the map as the SQL seed of the migration `20261201040000_option_code_map.sql`. The migration holds this
 * text between its markers and `sql.test.ts` checks that it still matches `OPTION_CODE_MAP_SEED`, so the rows in
 * the database cannot drift from the published sources they quote. Same idiom, and the same `literal`, as the
 * catalogue's own seed (`lib/catalogue/seed/sql.ts`).
 */

export const SEED_BEGIN = "-- BEGIN GENERATED SEED (lib/option-codes/seed/sql.ts; do not edit by hand)";
export const SEED_END = "-- END GENERATED SEED";

const COLUMNS = [
  "article_id", "position", "registry_key", "registry_choice", "option_group", "option_code", "kind", "sources", "note", "rule_id",
] as const;

const articleId = (code: string): string => `(select id from public.base_articles where code = ${literal(code)})`;

/** A jsonb literal. `literal` writes a JavaScript array as a text array, so the JSON is quoted as text first. */
const jsonb = (value: unknown): string => `${literal(JSON.stringify(value))}::jsonb`;

const row = (mapping: OptionCodeMapping, position: number): string =>
  [
    articleId(mapping.articleCode),
    literal(position),
    literal(mapping.registryKey),
    literal(mapping.registryChoice),
    literal(mapping.optionGroup),
    literal(mapping.optionCode),
    literal(mapping.kind),
    jsonb(mapping.sources),
    literal(mapping.note),
    literal(mapping.ruleId),
  ].join(", ");

/** The seed statement for these rows, in the order given, so the same map always gives the same text. */
export function seedSql(mappings: readonly OptionCodeMapping[]): string {
  if (mappings.length === 0) return "";
  const values = mappings.map((mapping, position) => `  (${row(mapping, position)})`).join(",\n");
  return `insert into public.option_code_map (${COLUMNS.join(", ")}) values\n${values};\n`;
}

/** The seed text a migration holds between the markers, or undefined when it has none. */
export function seedBlockOf(migration: string): string | undefined {
  const start = migration.indexOf(SEED_BEGIN);
  const end = migration.indexOf(SEED_END);
  if (start < 0 || end < start) return undefined;
  return migration.slice(start + SEED_BEGIN.length + 1, end);
}
