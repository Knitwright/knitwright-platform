#!/usr/bin/env node
/**
 * Writes the index table in docs/decisions/README.md from the decision records themselves.
 *
 * Why this exists: the index used to be edited by hand, so every workstream added its row to the
 * end of one table and every pair of live branches conflicted on it. Now a workstream writes only
 * its own record and runs this, and the shared file is derived rather than edited.
 *
 * Each record supplies its row:
 *   - the number and the title come from the `# NNNN: Title` heading;
 *   - `Index title:` overrides the title where the index is deliberately shorter than the heading
 *     (several records carry a workstream suffix such as "(W4-C)" that the index leaves out);
 *   - `Index:` is the short reading of the record's state, and `Status:` is used when it is absent.
 *
 * Run `node scripts/write-decision-index.mjs` to rewrite the table, or with `--check` to fail
 * without writing when the table is out of date. `tests/architecture/decision-index.test.ts` runs
 * the check, so a stale index fails CI rather than drifting.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DECISIONS = fileURLToPath(new URL("../docs/decisions/", import.meta.url));
const README = join(DECISIONS, "README.md");
const START = "<!-- The table below is written by scripts/write-decision-index.mjs. Do not edit it by hand. -->";
const END = "<!-- End of the generated table. -->";

const field = (body, name) => {
  const found = new RegExp(`^${name}:\\s*(.*)$`, "m").exec(body);
  return found === null ? null : found[1].trim();
};

/** Every record's row, in number order. The template and anything unnumbered are left out. */
export const rows = () => {
  const found = [];
  for (const file of readdirSync(DECISIONS).sort()) {
    if (!/^\d{4}-.*\.md$/.test(file) || file.startsWith("0000-")) continue;
    const body = readFileSync(join(DECISIONS, file), "utf8");
    // Most headings read `# 0062: Title`; a few of the older ones use a full stop.
    const heading = /^#\s*(\d{4})\s*[:.]\s*(.*)$/m.exec(body);
    if (heading === null) throw new Error(`${file}: no "# NNNN: Title" heading, so it cannot be indexed.`);
    if (heading[1] !== file.slice(0, 4)) throw new Error(`${file}: the heading says ${heading[1]} and the filename says ${file.slice(0, 4)}.`);
    const status = field(body, "Index") ?? field(body, "Status");
    if (status === null) throw new Error(`${file}: no "Index:" or "Status:" line, so it has nothing to show in the status column.`);
    const already = found.find((row) => row.number === heading[1]);
    if (already !== undefined) {
      // Two workstreams each took "the next free number" without being able to see the other. It
      // happened twice in one day: L2 and L4 on a migration hour, then O3 and the top bar on 0103.
      // Each branch is correct alone, so only the merge can catch it -- here, in a second.
      throw new Error(`${file} and ${already.file} are both numbered ${heading[1]}. Move the later one to the next free number and rename every citation of it.`);
    }
    found.push({ number: heading[1], title: field(body, "Index title") ?? heading[2].trim(), file, status });
  }
  return found;
};

const table = () =>
  ["| No. | Decision | Status |", "|---|---|---|", ...rows().map((row) => `| ${row.number} | [${row.title}](${row.file}) | ${row.status} |`)].join("\n");

/** The README with its generated table replaced. */
export const rendered = () => {
  const current = readFileSync(README, "utf8");
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if (start === -1 || end === -1) throw new Error(`docs/decisions/README.md has lost its generated-table markers (${START}).`);
  const tail = current.slice(end);
  return `${current.slice(0, start + START.length)}\n\n${table()}\n\n${tail.endsWith("\n") ? tail : `${tail}\n`}`;
};

const main = () => {
  const next = rendered();
  if (process.argv.includes("--check")) {
    if (next !== readFileSync(README, "utf8")) {
      process.stderr.write("docs/decisions/README.md is out of date. Run: node scripts/write-decision-index.mjs\n");
      process.exit(1);
    }
    return;
  }
  writeFileSync(README, next);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
