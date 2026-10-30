import { z } from "zod";
import { MAPPING_KINDS, type OptionCodeMapping } from "./types";

/**
 * The database rows of `option_code_map`, checked with zod and turned into the map's own type. Same idiom as
 * `lib/catalogue/rows.ts`: PostgREST sends jsonb as parsed JSON, and nothing is trusted without being parsed.
 */

export const citationRow = z.object({ file: z.string().min(1), quote: z.string().min(1) });

export const mappingRow = z.object({
  position: z.number().int(),
  registry_key: z.string().nullable(),
  registry_choice: z.string().nullable(),
  option_group: z.string().nullable(),
  option_code: z.string().nullable(),
  kind: z.enum(MAPPING_KINDS),
  sources: z.array(citationRow),
  note: z.string().nullable(),
  rule_id: z.string().regex(/^R-[A-Z]{2,5}-\d{3}$/),
});

export type MappingRow = z.infer<typeof mappingRow>;

/** The columns a read asks for. The article is found by its code first, as the catalogue's own reads do. */
export const MAPPING_SELECT = "position, registry_key, registry_choice, option_group, option_code, kind, sources, note, rule_id";

/** One row as the map's own type. The article code is the one the read asked for. */
export const toMapping = (articleCode: string, row: MappingRow): OptionCodeMapping => ({
  articleCode,
  registryKey: row.registry_key,
  registryChoice: row.registry_choice,
  optionGroup: row.option_group,
  optionCode: row.option_code,
  kind: row.kind,
  sources: row.sources.map((source) => ({ file: source.file, quote: source.quote })),
  note: row.note,
  ruleId: row.rule_id,
});

/** A row as the database holds it, for the seed and for a test that reads rows back. */
export const rowOf = (mapping: OptionCodeMapping, position: number): MappingRow => ({
  position,
  registry_key: mapping.registryKey,
  registry_choice: mapping.registryChoice,
  option_group: mapping.optionGroup,
  option_code: mapping.optionCode,
  kind: mapping.kind,
  sources: mapping.sources.map((source) => ({ file: source.file, quote: source.quote })),
  note: mapping.note,
  rule_id: mapping.ruleId,
});
