import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The words that would make something look settled (plans/platform-v4.md, rules). They may appear in a
 * sentence only to say something is NOT done. None of the ops text needs them.
 */
const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;
const ROOT = join(__dirname, "..", "..");

const walk = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [join(ROOT, dir, e.name)] : [],
  );

const sentencesIn = (path: string): string[] => {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) found.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

describe("ops wording", () => {
  const files = [...walk("lib/ops"), ...walk("components/ops"), ...walk("app/(ops)")];

  it("finds the files it scans", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("uses none of the words that read as settled", () => {
    for (const path of files) for (const sentence of sentencesIn(path)) expect(sentence, path).not.toMatch(SETTLED);
  });
});
