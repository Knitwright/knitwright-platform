import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The wording rule of `lib/techpack/wording.test.ts`, applied to the studio home, the catalogue and
 * the article page: nothing may read as a settled factory fact when it is not. Every seeded price,
 * tier and lead time is a placeholder, and the pictures are renders rather than photographs, so
 * none of the words below may appear outside the sentences listed one by one.
 */
const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;

/** Each sentence that may hold one of the words, and why it is allowed. */
const ALLOWED: readonly string[] = [
  // The one rule the create-new modal keeps: nothing claims a factory approved anything.
  "factory-approved", // only inside the test that forbids it
  "to confirm", // a count of what is still missing on a design card
  "things to confirm",
  "thing to confirm",
];

const ROOT = join(__dirname, "..", "..");

const listed = (dir: string, pattern: RegExp): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name) && !/\.test\./.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));

const SOURCES = [...listed("lib/home", /\.ts$/), ...listed("components/studio/home", /\.tsx?$/)];

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

describe("the words that would make the home or the catalogue look settled", () => {
  it("finds the files it scans", () => {
    expect(SOURCES.length).toBeGreaterThan(14);
    expect(SOURCES.flatMap(sentencesIn).length).toBeGreaterThan(200);
  });

  it("appear in no sentence of the studio home, the catalogue or the article page", () => {
    for (const path of SOURCES) {
      for (const sentence of sentencesIn(path)) {
        expect(withoutAllowed(sentence), `${path}: ${sentence}`).not.toMatch(SETTLED);
      }
    }
  });

  it("says a price is a placeholder wherever one is shown", () => {
    const price = readFileSync(join(ROOT, "lib/home/price.ts"), "utf8");
    expect(price).toMatch(/placeholder/i);
    const card = readFileSync(join(ROOT, "components/studio/home/ArticleCard.tsx"), "utf8");
    expect(card).toContain("card.price.label");
  });

  it("labels every picture a render rather than a photograph", () => {
    const view = readFileSync(join(ROOT, "lib/home/article-view.ts"), "utf8");
    expect(view).toContain("Render, not photo");
    for (const path of ["components/studio/home/ArticleCard.tsx", "components/studio/home/ArticleSections.tsx"]) {
      expect(readFileSync(join(ROOT, path), "utf8"), path).toContain("RENDER_NOTICE");
    }
  });
});
