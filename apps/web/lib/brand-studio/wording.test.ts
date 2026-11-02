import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Rule 3, for Brand Studio: nothing it shows may read as a settled factory fact when it is not.
 * This is `lib/techpack/wording.test.ts` applied to `lib/brand-studio/**`, `lib/colour/**` and
 * `components/brand-studio/**`, which the tech pack's own scan does not reach.
 *
 * The sublimation gamut and the Pantone codes are exactly where this could go wrong: the gamut is
 * Knitwright's own estimate with no ICC profile behind it, and no Pantone data ships at all.
 */

const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;

/** Each phrase that may hold one of those words, and why. Every one says a thing is NOT settled. */
const ALLOWED: readonly string[] = [
  "no Pantone TCX code, so a factory has nothing to match to", // says the colour has no factory reference
  "no Pantone TCX code yet", // the same, as a short label
  "not reviewed by anyone", // the label on Knitwright's own weighting
  "no licence on file", // says a font's licence is NOT established
  "No licence for a font of this kind is on file", // the same, in full
];

const ROOT = join(__dirname, "..", "..");

const listed = (dir: string, pattern: RegExp): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name) && !/\.test\./.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));

const SOURCES = [...listed("lib/brand-studio", /\.ts$/), ...listed("lib/colour", /\.ts$/), ...listed("components/brand-studio", /\.tsx?$/)];

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

describe("the words Brand Studio shows", () => {
  it("finds the files it scans", () => {
    expect(SOURCES.length).toBeGreaterThan(12);
  });

  it("never makes something sound settled", () => {
    const offenders = SOURCES.flatMap((path) =>
      sentencesIn(path)
        .filter((sentence) => SETTLED.test(withoutAllowed(sentence)))
        .map((sentence) => `${path}: ${sentence}`),
    );
    expect(offenders).toEqual([]);
  });

  it("says the sublimation gamut is an estimate wherever it names one", () => {
    const claims = SOURCES.flatMap((path) => sentencesIn(path)).filter((sentence) => /sublimation-safe|sublimation print/i.test(sentence));
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.every((sentence) => /estimate/i.test(sentence))).toBe(true);
  });

  it("never says a Pantone code was worked out, because no Pantone data ships", () => {
    const sentences = SOURCES.flatMap((path) => sentencesIn(path));
    expect(sentences.filter((sentence) => /nearest Pantone|matching Pantone|Pantone match/i.test(sentence))).toEqual([]);
  });
});
