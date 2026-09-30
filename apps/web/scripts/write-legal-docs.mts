/**
 * Writes docs/legal/*.md from the text in lib/legal, so the owner and the lawyer review exactly
 * what the site shows. Run it from apps/web after changing a legal page:
 *
 *   pnpm --filter web exec tsx scripts/write-legal-docs.mts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { LEGAL_DOCUMENTS, legalFilePath } from "@/lib/legal/documents";
import { toMarkdown } from "@/lib/legal/model";

for (const doc of LEGAL_DOCUMENTS) {
  const path = legalFilePath(doc.slug);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, toMarkdown(doc));
  process.stdout.write(`${path}\n`);
}
