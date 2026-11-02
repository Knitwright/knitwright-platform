import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The words this workstream's screens may not use (plan rule 3, as `lib/techpack/wording.test.ts`
 * holds the tech pack's own pages to it). Nothing in a marketing panel may read as settled: no
 * layout is reviewed, no figure is agreed, and no export is certified by anyone.
 *
 * It also holds two rules of this workstream's own:
 *
 *   * **nothing claims to be licensed artwork**, because every element is drawn by this code;
 *   * **nothing promises a colour match**, because no colour profile is on file.
 */

const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;

/** Each sentence that may hold one of those words, and why. Every one says a thing is NOT settled. */
const ALLOWED: readonly string[] = [
  "not reviewed by anyone", // the label on every seeded row
  "Nobody has reviewed them", // the picker's own line
  "Nobody has reviewed these figures", // the export panel's line about a size of its own
];

const ROOT = join(__dirname, "..", "..");

const sourcesIn = (dir: string, pattern: RegExp): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name) && !/\.test\./.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));

const SOURCES = [...sourcesIn("lib/marketing", /\.ts$/), ...sourcesIn("components/marketing", /\.tsx?$/)];

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

describe("the words a marketing panel may not use", () => {
  it("finds the files it scans", () => {
    expect(SOURCES.length).toBeGreaterThan(25);
    expect(SOURCES.flatMap(sentencesIn).length).toBeGreaterThan(300);
  });

  it("says nothing that would read as settled, outside the sentences listed above", () => {
    for (const path of SOURCES) {
      for (const sentence of sentencesIn(path)) {
        expect(withoutAllowed(sentence), `${path}: ${sentence}`).not.toMatch(SETTLED);
      }
    }
  });

  it("never calls an element licensed artwork, because this code draws every one of them", () => {
    for (const path of SOURCES) {
      for (const sentence of sentencesIn(path)) {
        if (!/licensed/i.test(sentence)) continue;
        // The only sentence that may use the word is the one saying there is no such library.
        expect(sentence, path).toContain("No licensed graphics library is on file");
      }
    }
  });

  it("never promises a colour match, because no colour profile is on file", () => {
    for (const path of SOURCES) {
      for (const sentence of sentencesIn(path)) {
        expect(sentence, path).not.toMatch(/\b(exact|accurate|true) colour\b/i);
        expect(sentence, path).not.toMatch(/\bcolour[- ]accurate\b/i);
      }
    }
  });
});
