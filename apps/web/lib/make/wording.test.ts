import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Plan rule: nothing a person reads may sound settled when it is not, and no price or date may be written into the
 * source (owner decision 1 and "data, not constants"). This scans every string and piece of text the make flow can
 * show: its own modules, its components and its pages.
 *
 * The words below are allowed only as the stored names listed one by one. Every sentence a person reads says
 * "signed off", which is what a golden sample actually is: the founder's own recorded act, with the date and the
 * account that did it. It never says a factory has checked anything, because none has.
 */
const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;

/** Each string that may hold one of the words, and why. None of them is a sentence. */
const ALLOWED: readonly string[] = [
  "approved", // the stored state of a golden sample the founder signed off, and the database's own column names
  "approved_at",
  "approved_by",
  "sign_off_golden_sample",
  "confirm_brand_product_stage", // the brand run function this flow calls (decision 0062)
];

const ROOT = join(__dirname, "..", "..");
const sources = (dir: string, pattern = /\.tsx?$/): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name) && !/\.test\./.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));

const SOURCES = [...sources("lib/make"), ...sources("components/make"), ...sources("app/(app)/studio/[projectId]/make")];

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

describe("the words of the make flow", () => {
  it("reads every one of its files", () => {
    expect(SOURCES.length).toBeGreaterThan(14);
    expect(SOURCES.flatMap(sentencesIn).length).toBeGreaterThan(200);
  });

  it.each(SOURCES)("%s says nothing is settled that is not", (path) => {
    for (const sentence of sentencesIn(path)) {
      expect(withoutAllowed(sentence), sentence).not.toMatch(SETTLED);
    }
  });

  it("writes no price and no money of its own: every figure comes from a row", () => {
    const all = SOURCES.flatMap(sentencesIn).join("\n");
    expect(all).not.toMatch(/[$£€]\s?\d/);
    expect(all).not.toMatch(/\b\d+\.\d{2}\s?(GBP|AUD|USD|EUR)\b/);
  });

  it("promises no date of its own", () => {
    const all = SOURCES.flatMap(sentencesIn).join("\n");
    expect(all).not.toMatch(/\b20\d{2}-\d{2}-\d{2}\b/);
  });

  it("names the Store as the one that publishes, and offers no payment of its own", () => {
    const all = SOURCES.flatMap(sentencesIn).join("\n");
    expect(all).toContain("Handled by the Knitwright Store");
    expect(all).not.toMatch(/\b(checkout|cart|stripe|payout|deposit)\b/i);
  });
});
