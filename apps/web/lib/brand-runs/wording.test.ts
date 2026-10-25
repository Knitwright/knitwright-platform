import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/** Plan rule 3: nothing a person reads may sound settled. Scans every string and piece of text in the brand workspace. */
const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;
const ROOT = join(__dirname, "..", "..");
const files = (dir: string) => readdirSync(join(ROOT, dir)).filter((n) => /\.tsx?$/.test(n) && !/\.test\./.test(n)).map((n) => join(ROOT, dir, n));
const SOURCES = [...files("lib/brand-runs"), ...files("components/brand-runs"), join(ROOT, "app/(app)/brand/page.tsx")];

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

describe("brand workspace wording", () => {
  it("reads at least some sentences", () => {
    expect(SOURCES.flatMap(sentencesIn).length).toBeGreaterThan(40);
  });
  it.each(SOURCES)("%s says nothing is settled", (path) => {
    for (const sentence of sentencesIn(path)) expect(sentence, sentence).not.toMatch(SETTLED);
  });
  it("never offers a price of its own", () => {
    const all = SOURCES.flatMap(sentencesIn).join("\n");
    expect(all).toContain("Knitwright will quote");
    expect(all).not.toMatch(/[$£€]\s?\d/);
  });
});
