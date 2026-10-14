import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { FORBIDDEN_WORDS } from "./report";

/** The screen and the report say "close reading of your picture". These words are never used in what a person reads. */
const ROOT = join(__dirname, "..", "..");
const sources = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) && !e.parentPath.includes("fixtures"))
    .map((e) => join(e.parentPath, e.name));

function sentencesIn(path: string): string[] {
  const file = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) found.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe("what a person reads", () => {
  it("never says exact, identical or matches your picture", () => {
    const files = [...sources("lib/design-import"), ...sources("components/design-import"), ...sources("app/api/design-import")].filter((f) => !f.endsWith("report.ts") && !f.includes("cleanup.ts"));
    const offenders = files.flatMap((f) => sentencesIn(f).filter((s) => FORBIDDEN_WORDS.test(s)).map((s) => `${f}: ${s}`));
    expect(offenders).toEqual([]);
  });

  it("does not use the techpack's settled words in a sentence a person reads", () => {
    const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;
    const files = [...sources("components/design-import"), join(ROOT, "lib/design-import/report.ts"), join(ROOT, "lib/design-import/view-model.ts"), join(ROOT, "lib/design-import/assemble.ts")];
    const offenders = files.flatMap((f) => sentencesIn(f).filter((s) => SETTLED.test(s)).map((s) => `${f}: ${s}`));
    expect(offenders).toEqual([]);
  });
});
