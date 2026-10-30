import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rowOf, type MappingRow } from "../rows";
import { OPTION_CODE_MAP_SEED } from "../seed/rows";

/** TEST FIXTURE ONLY: the published files the map quotes, and the migration it seeds. Tests read them; the app never does. */

/** The repository root, from apps/web/lib/option-codes/fixtures. */
export const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

/** One published file the map cites, by its path from the repository root. */
export const readCited = (file: string): string => readFileSync(join(REPO_ROOT, file), "utf8");

export const readMigration = (): string =>
  readFileSync(join(REPO_ROOT, "supabase", "migrations", "20261201040000_option_code_map.sql"), "utf8");

/** The rows PostgREST would send for the seeded map, in the order the database returns them. */
export const mappingRows = (): readonly MappingRow[] => OPTION_CODE_MAP_SEED.map((mapping, position) => rowOf(mapping, position));
