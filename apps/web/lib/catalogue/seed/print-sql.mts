/**
 * Prints the catalogue seed SQL for the migration, from the build pack's article.json. Run from apps/web:
 *
 *   pnpm --filter web exec tsx lib/catalogue/seed/print-sql.mts
 *
 * and paste the output between the seed markers of supabase/migrations/20261101010000_base_articles.sql.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launchCatalogue } from "./launch";
import { seedSql } from "./sql";

const source = fileURLToPath(new URL("../../../../../docs/spec/articles/JSY-SS-01/article.json", import.meta.url));
process.stdout.write(seedSql(launchCatalogue(JSON.parse(readFileSync(source, "utf8")))));
