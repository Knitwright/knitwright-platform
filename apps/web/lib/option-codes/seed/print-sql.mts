/**
 * Prints the option code map's seed SQL for its migration. Run from apps/web:
 *
 *   pnpm --filter web exec tsx lib/option-codes/seed/print-sql.mts
 *
 * and paste the output between the seed markers of supabase/migrations/20261201040000_option_code_map.sql.
 */
import { OPTION_CODE_MAP_SEED } from "./rows";
import { seedSql } from "./sql";

process.stdout.write(seedSql(OPTION_CODE_MAP_SEED));
