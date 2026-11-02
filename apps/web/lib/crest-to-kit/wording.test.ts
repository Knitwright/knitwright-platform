import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { PANTONE_GAP } from "./palette";
import { COLOUR_NOTE, NO_DATE_NOTE } from "./words";
import { NO_PAYMENT_HERE, PRICES_AS_STORED } from "@/lib/quotes";

/**
 * The wording rule of `lib/techpack/wording.test.ts`, applied to crest-to-kit and the quote. Four
 * things must never be readable off these screens or off the document.
 *
 * 1. A settled factory fact. Every seeded price, tier and option is a placeholder (decisions 0066
 *    and 0071), so none of the words below may appear outside the sentences listed one by one.
 * 2. The Store. Knitwright shows the price and hands the order over; it never takes money (owner
 *    decision 1), so no word of a cart, a checkout, a payment or a storefront appears here.
 * 3. A Pantone match. The platform holds no Pantone values (open item P6), so no screen may print
 *    a Pantone number, and the one sentence that names Pantone says there is none.
 * 4. A delivery date. QC days and freight days are both unset, so nothing here may print a date.
 */

const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;

/** Each sentence that may hold one of the words, and why it is allowed. */
const ALLOWED: readonly string[] = [
  // The rule the engine applies to every option code and every parameter it writes.
  "the range the factory approved",
  "the article does not offer",
  "a range the factory approved",
  // Said of a kit the checks let through, and of the kits as a whole on the screen.
  "checked against the base article before it was shown",
  "failed a manufacturing check",
  "failed a manufacturing check, so none is offered",
  // Said of a candidate that was held back, which is the opposite of a settled fact.
  "could not be held to a range",
  // The placeholder price of names and numbers, from R-COST-003.
  "until the factory confirms it",
  // The market rows say of themselves that they are not settled.
  "to confirm with a customs adviser",
  // The things the screen names as still open, each said to be open.
  "Checking they can be printed",
  "Checking each one can be made",
];

const STORE = /\b(cart|basket|checkout|stripe|payment|pay now|storefront|payout|drop ship)\b/i;

/**
 * The basket is the quote's own word for what is being priced, and the specification uses it:
 * "tiers counted across the whole basket". The Store sentence names the Store and says it takes
 * the money, which is the point of it.
 */
const STORE_ALLOWED: readonly string[] = [
  NO_PAYMENT_HERE,
  "the whole basket",
  "pieces in the basket",
  "in this basket",
  "the basket it came from",
  "the basket at",
  "basket quantity",
  "no basket line behind it",
  "the basket",
  "a basket",
  "one basket",
  "two baskets",
];

/** A Pantone number, which this repository holds none of and so may never print. */
const PANTONE_NUMBER = /\bpantone\s*[0-9]/i;

/** A date, which nothing may print while the days for QC and the freight days are unset. */
const PRINTED_DATE = /\b20[0-9]{2}-[0-9]{2}-[0-9]{2}\b/;

const ROOT = join(__dirname, "..", "..");

const listed = (dir: string, pattern: RegExp): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name) && !/\.test\./.test(entry.name) && !entry.parentPath.includes("fixtures"))
    .map((entry) => join(entry.parentPath, entry.name));

const SOURCES = [
  ...listed("lib/crest-to-kit", /\.ts$/),
  ...listed("lib/quotes", /\.ts$/),
  ...listed("components/crest-to-kit", /\.tsx?$/),
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

const without = (allowed: readonly string[], text: string): string => allowed.reduce((left, phrase) => left.split(phrase).join(" "), text);

describe("the words of crest-to-kit and the quote", () => {
  it("finds the files it scans", () => {
    expect(SOURCES.length).toBeGreaterThan(16);
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

  it("print no Pantone number, and say plainly that there is none to print", () => {
    for (const path of SOURCES) {
      for (const sentence of sentencesIn(path)) expect(sentence, `${path}: ${sentence}`).not.toMatch(PANTONE_NUMBER);
    }
    expect(PANTONE_GAP).toContain("no Pantone number can be given");
    expect(COLOUR_NOTE).toContain("not a colour match");
  });

  it("print no delivery date, because no part of the sum is on file", () => {
    for (const path of SOURCES) {
      for (const sentence of sentencesIn(path)) expect(sentence, `${path}: ${sentence}`).not.toMatch(PRINTED_DATE);
    }
    expect(NO_DATE_NOTE).toContain("No delivery date can be shown yet");
    expect(NO_DATE_NOTE).toContain("the freight days are not set");
  });

  it("add no tax to any figure, and say so", () => {
    expect(PRICES_AS_STORED).toContain("no tax is added to or taken off any figure");
  });

  it("would catch a sentence that said a thing was settled, or took money, or named a Pantone", () => {
    for (const bad of ["Approved by the factory", "The final kit", "All values verified"]) expect(without(ALLOWED, bad)).toMatch(SETTLED);
    for (const bad of ["Add to cart", "Pay now", "Go to checkout"]) expect(without(STORE_ALLOWED, bad)).toMatch(STORE);
    expect("Pantone 19-4052 TCX").toMatch(PANTONE_NUMBER);
    expect("Delivery 2026-12-01").toMatch(PRINTED_DATE);
  });
});
