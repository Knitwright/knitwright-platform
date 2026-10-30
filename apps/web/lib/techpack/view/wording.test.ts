import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { bareArticle, emptyDesign, emptyHeader, input, mark } from "./fixtures/views";
import { buildTechPackView } from "./model";
import { cellsOf } from "./rows";

/**
 * The wording rules, over this workstream's own files (`lib/techpack/wording.test.ts` holds the same
 * rule for the tech pack document and the screens). Nothing the tech pack view says may read as a
 * settled factory fact when it is not: the tabs are full of values nobody has confirmed, and the
 * amber chip is the whole point of them.
 *
 * The chip "Confirmed" is one word, and the one allowance below is for it. A word on a chip states
 * nothing on its own; a sentence does, and no sentence here may hold one of these words.
 */
const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;

const HERE = __dirname;

const files = (): readonly string[] =>
  readdirSync(HERE, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.includes(".test.") && !entry.parentPath.includes("fixtures"))
    .map((entry) => join(entry.parentPath, entry.name));

/** Every string, template and piece of text in a source file. Comments and names are not included. */
function sentencesIn(path: string): string[] {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) found.push(node.text);
    if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) found.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Text a person reads as a sentence: more than one word, and not a class list, an id or a key. */
const isProse = (text: string): boolean => /\s/.test(text.trim()) && !/[[\]{}=]/.test(text);

/** The one allowance: the chip of spec F-S6, which is a single word and claims nothing by itself. */
const ALLOWED: readonly string[] = ["Needs your input"];
const withoutAllowed = (text: string): string => ALLOWED.reduce((left, phrase) => left.split(phrase).join(" "), text);

describe("the words of the tech pack view", () => {
  it("finds the files it scans", () => {
    expect(files().length).toBeGreaterThan(10);
    expect(files().flatMap(sentencesIn).length).toBeGreaterThan(100);
  });

  it("would be caught in a sentence that says a thing is settled", () => {
    for (const bad of ["This is checked.", "Approved by the factory", "The final spec", "All confirmed by them"]) {
      expect(withoutAllowed(bad)).toMatch(SETTLED);
    }
  });

  it("hold none of the settled words in any sentence of this workstream's own files", () => {
    const found: string[] = [];
    for (const path of files()) {
      for (const sentence of sentencesIn(path).filter(isProse)) {
        if (SETTLED.test(withoutAllowed(sentence))) found.push(`${path.slice(HERE.length + 1)}: ${sentence}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("hold none of them in any value of a built view either, for a full design and for an empty one", () => {
    const built = [
      buildTechPackView(input({ marks: [mark(), mark({ id: "m2", tool: "callout", note: "Tape it" })] })),
      buildTechPackView(input({ article: bareArticle(), sizes: bareArticle().sizeRange })),
      buildTechPackView(input({ article: null, spec: emptyDesign(), header: emptyHeader(), sizes: [] })),
    ];
    for (const view of built) {
      const text = [
        ...view.tabs.flatMap((entry) => [
          entry.lead,
          ...entry.sections.flatMap((part) => [part.title, part.note ?? "", ...part.tables.flatMap((item) => [item.title, item.note ?? "", item.addLabel ?? ""])]),
          ...cellsOf(entry).map((cell) => cell.text ?? ""),
        ]),
        view.measurements.note ?? "",
        view.autoMap.message,
        view.review.summary,
        ...view.review.checks.flatMap((check) => [check.label, check.detail]),
        ...view.review.items.map((item) => item.label),
      ];
      for (const sentence of text.filter(isProse)) {
        expect(withoutAllowed(sentence), sentence).not.toMatch(SETTLED);
      }
    }
  });

  it("never write the words that stand for a missing value into a value", () => {
    for (const view of [buildTechPackView(input()), buildTechPackView(input({ article: null, spec: emptyDesign(), header: emptyHeader(), sizes: [] }))]) {
      for (const entry of view.tabs.flatMap(cellsOf)) {
        expect(entry.text ?? "", entry.label).not.toContain("[TBC]");
        expect(entry.text ?? "", entry.label).not.toContain("To be confirmed");
      }
    }
  });
});
