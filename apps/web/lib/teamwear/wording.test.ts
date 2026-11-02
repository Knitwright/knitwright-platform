import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { HANDOFF_LABEL, HANDOFF_NOTE } from "./handoff";

/**
 * The wording rule of `lib/techpack/wording.test.ts`, applied to the teamwear configurator. Two
 * things must never be readable off this screen.
 *
 * The first is a settled factory fact. Every seeded price and tier is a placeholder (decision 0071)
 * and the one article with options is a Knitwright draft (decision 0066), so none of the words below
 * may appear outside the sentences listed one by one.
 *
 * The second is the Store. The platform shows the price and hands the order over; it never takes
 * money (owner decision 1), so no word of a cart, a checkout, a payment, a storefront or a payout
 * appears anywhere in this workstream.
 */
const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;

/** Each sentence that may hold one of the words, and why it is allowed. */
const ALLOWED: readonly string[] = [
  // The row that offers the article's ranges says whose ranges they are.
  "Measurements the factory approves",
  // The rule the configurator applies to every option code and every parameter.
  "the range the factory approved",
  "the article does not offer",
  // The placeholder price of names and numbers, from R-COST-003.
  "until the factory confirms it",
];

const STORE = /\b(cart|basket|checkout|stripe|payment|pay now|storefront|payout|drop ship)\b/i;

/** The hand-off's own sentence names the Store and says it takes the payment, which is the point of it. */
const STORE_ALLOWED: readonly string[] = [HANDOFF_LABEL, HANDOFF_NOTE];

const ROOT = join(__dirname, "..", "..");

const listed = (dir: string, pattern: RegExp): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name) && !/\.test\./.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));

const SOURCES = [...listed("lib/teamwear", /\.ts$/), ...listed("components/teamwear", /\.tsx?$/)];

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

const without = (allowed: readonly string[], text: string): string => allowed.reduce((left, phrase) => left.split(phrase).join(" "), text);

describe("the words of the teamwear configurator", () => {
  it("finds the files it scans", () => {
    expect(SOURCES.length).toBeGreaterThan(14);
    expect(SOURCES.flatMap(sentencesIn).length).toBeGreaterThan(150);
  });

  it("never read as a settled factory fact", () => {
    for (const path of SOURCES) {
      for (const sentence of sentencesIn(path)) {
        expect(without(ALLOWED, sentence), `${path}: ${sentence}`).not.toMatch(SETTLED);
      }
    }
  });

  it("build no Store concept: no cart, no checkout, no payment and no storefront", () => {
    for (const path of SOURCES) {
      for (const sentence of sentencesIn(path)) {
        expect(without(STORE_ALLOWED, sentence), `${path}: ${sentence}`).not.toMatch(STORE);
      }
    }
  });

  it("offers a hand-off and never an Add to cart", () => {
    expect(HANDOFF_LABEL).not.toMatch(/cart/i);
    expect(HANDOFF_NOTE).toMatch(/does not take payment here/);
  });
});
