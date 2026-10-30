import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The wording rules, applied to this workstream (plan v5 rules; the same scan as `lib/techpack/wording.test.ts`).
 * Nothing the inspiration panel shows may read as settled: a suggestion has been looked at by the checks, which is
 * not the same as being approved, and saying so would be exactly the settled-sounding claim the rules exist to stop.
 */
const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;

/** Each phrase that may hold one of the words, and why. Each one says that something is NOT settled. */
const ALLOWED: readonly string[] = [
  "No blocker was raised against", // what a suggestion's line really claims
  "Draft, not yet confirmed by the factory", // the rulebook's own words, reached through the Why? link
];

const ROOT = join(__dirname, "..", "..");

const listed = (dir: string, pattern: RegExp): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name) && !/\.test\./.test(entry.name))
    .map((entry) => join(ROOT, dir, entry.name));

const SOURCES = [
  ...listed("lib/inspiration", /\.ts$/),
  ...listed("lib/inspiration/sources", /\.ts$/),
  ...listed("lib/inspiration/suggest", /\.ts$/),
  ...listed("components/inspiration", /\.tsx?$/),
];

/** Every string, template and piece of text in a source file. Comments and names are not included. */
function sentencesIn(path: string): string[] {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) found.push(node.text);
    if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) found.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const withoutAllowed = (text: string): string => ALLOWED.reduce((left, phrase) => left.split(phrase).join(" "), text);

describe("the words that would make an inspiration suggestion look settled", () => {
  it("finds the files it scans", () => {
    expect(SOURCES.length).toBeGreaterThan(14);
    expect(SOURCES.flatMap(sentencesIn).length).toBeGreaterThan(100);
  });

  it("appear in no sentence of the board, the panel or the suggestions, except the phrases listed above", () => {
    for (const path of SOURCES) {
      for (const sentence of sentencesIn(path)) {
        expect(withoutAllowed(sentence), `${path}: ${sentence}`).not.toMatch(SETTLED);
      }
    }
  });
});
