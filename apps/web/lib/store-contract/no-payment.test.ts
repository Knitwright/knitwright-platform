import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { NOT_IN_THIS_CONTRACT } from "./payload";
import { SAMPLE_PAYLOADS } from "./fixtures/payloads";

/**
 * The platform is not a shop (owner decision 1).
 *
 * This is the test the whole workstream turns on. The Store is a separate product, and nothing in
 * this platform may take money: no cart, no checkout, no provider, no shop front, no takings, no
 * team store link. So no key and no sentence of any payload, and no string in any file of this
 * directory or of the endpoints, may name one of those things. A field that looks as though it is
 * about taking money belongs to the Store, not here.
 *
 * `price` and `currency` are not on the list: tier prices in pounds and Australian dollars are what
 * this contract is for (plan v5 O2). Quoting a figure is not taking money.
 */

const SHOP_WORDS = /cart|checkout|stripe|paypal|payment|pay\b|paid|payout|storefront|shopify|basket|tender|till\b|refund|discount|coupon|voucher|subscription/i;

/** The one place those words may appear: the sentence that says none of them is in the contract. */
const ALLOWED = [NOT_IN_THIS_CONTRACT, "the Store, not Knitwright"];

const withoutAllowed = (text: string): string => ALLOWED.reduce((left, phrase) => left.split(phrase).join(" "), text);

const keysIn = (value: unknown): readonly string[] =>
  typeof value !== "object" || value === null
    ? []
    : Array.isArray(value)
      ? value.flatMap(keysIn)
      : Object.entries(value).flatMap(([key, inner]) => [key, ...keysIn(inner)]);

const ROOT = join(__dirname, "..", "..");

const sourcesIn = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourcesIn(join(dir, entry.name))
      : /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)
        ? [join(ROOT, dir, entry.name)]
        : [],
  );

/** Every string, template and piece of text in a source file. Comments and names are not included. */
function sentencesIn(path: string): string[] {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) found.push(node.text);
    if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) found.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("nothing in this contract takes money", () => {
  it("has no key in any payload that names a shop's concept", () => {
    for (const { prefix, value } of SAMPLE_PAYLOADS()) {
      expect(keysIn(value).filter((key) => SHOP_WORDS.test(key)), prefix).toEqual([]);
    }
  });

  it("has no sentence in any payload that names one either", () => {
    for (const { prefix, value } of SAMPLE_PAYLOADS()) {
      expect(withoutAllowed(JSON.stringify(value)), prefix).not.toMatch(SHOP_WORDS);
    }
  });

  it("has no such word in any file of this directory or of the endpoints", () => {
    const sources = [...sourcesIn("lib/store-contract"), ...sourcesIn("app/api/store")];
    expect(sources.length).toBeGreaterThan(10);
    for (const path of sources) {
      for (const sentence of sentencesIn(path)) {
        expect(withoutAllowed(sentence), `${path}: ${sentence}`).not.toMatch(SHOP_WORDS);
      }
    }
  });

  it("says so out loud, inside the manifest, because another product reads this", () => {
    expect(NOT_IN_THIS_CONTRACT).toContain("no cart");
    expect(NOT_IN_THIS_CONTRACT).toContain("submit_order_for_production");
  });

  it("would catch one of those words in a payload", () => {
    expect(withoutAllowed(JSON.stringify({ checkoutUrl: "x" }))).toMatch(SHOP_WORDS);
    expect(keysIn({ cart: { total: 1 } }).filter((key) => SHOP_WORDS.test(key))).toEqual(["cart"]);
  });
});
