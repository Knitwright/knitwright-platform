import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ACCURACY_LIMITS, CLOSE_READING, NOT_READ_YET, READING_INTRO } from "./wording";

/**
 * Plan W7d: a picture is read closely, not copied. The words "exact", "matches your picture" and "identical" are never
 * used, and nothing may read as settled (rule 3 of the plan, as `lib/techpack/wording.test.ts`). This scans every string in the
 * library and the screen, so a new sentence cannot slip a forbidden word in.
 */
const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;
const OVERCLAIM = /\bexact\b|matches your picture|identical|perfect|guaranteed/i;

/** The one code string that is the word: the database's count mode, never shown to anyone. */
const EXACT_COUNT_MODE = "exact";

const ROOT = join(__dirname, "..", "..");
const listed = (dir: string, pattern: RegExp): string[] =>
  readdirSync(join(ROOT, dir)).filter((name) => pattern.test(name) && !/\.test\./.test(name)).map((name) => join(ROOT, dir, name));

const SOURCES = [...listed("lib/design-import", /\.ts$/), ...listed("components/design-import", /\.tsx?$/)];

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

describe("the words of the design-from-a-picture screens", () => {
  it("finds the files it scans", () => {
    expect(SOURCES.length).toBeGreaterThan(15);
    expect(SOURCES.flatMap(sentencesIn).length).toBeGreaterThan(150);
  });

  it("never reads as settled, and never claims the result is exact", () => {
    const bad = SOURCES.flatMap((path) => sentencesIn(path).filter((text) => text !== EXACT_COUNT_MODE && (SETTLED.test(text) || OVERCLAIM.test(text))).map((text) => `${path}: ${text}`));
    expect(bad).toEqual([]);
  });

  it("always says it is a close reading and lists the accuracy limits", () => {
    expect(CLOSE_READING).toBe("Close reading of your picture");
    expect(READING_INTRO).toMatch(/close reading, not a copy/);
    const limits = ACCURACY_LIMITS.join(" ");
    for (const phrase of ["Shading", "flattened approximately", "lettering", "redrawn", "never invented", "estimated"]) expect(limits).toContain(phrase);
    expect(NOT_READ_YET.length).toBeGreaterThan(0);
  });
});
