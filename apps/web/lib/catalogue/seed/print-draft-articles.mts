/**
 * Prints `data/draft-articles.json`: the seven launch articles that have no factory block yet, read from the briefs
 * committed with the spec (docs/spec/articles/<CODE>/article.json, plan v5 workstream Z9). Run from apps/web:
 *
 *   pnpm --filter web exec tsx lib/catalogue/seed/print-draft-articles.mts > lib/catalogue/seed/data/draft-articles.json
 *
 * The bundled copy is what `launch.ts` reads, because nothing in this package imports from outside it;
 * `draft-article.test.ts` fails if a copy and its committed original ever differ.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DRAFT_CODES } from "./draft-article";

const root = fileURLToPath(new URL("../../../../../", import.meta.url));

const read = (code: string): unknown =>
  JSON.parse(readFileSync(`${root}docs/spec/articles/${code}/article.json`, "utf8")) as unknown;

const bundle = {
  note:
    "Copied from docs/spec/articles/<CODE>/article.json by lib/catalogue/seed/print-draft-articles.mts. Do not edit by " +
    "hand: edit the brief and print this file again.",
  articles: DRAFT_CODES.map(read),
};

process.stdout.write(`${JSON.stringify(bundle, null, 2)}\n`);
