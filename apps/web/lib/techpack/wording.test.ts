import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { completenessReport } from "./completeness";
import { CHARTS, fullDesign, packFor } from "./fixtures/designs";
import { completeProduction, targetedJersey } from "./fixtures/production";
import { ALL_KINDS_STACK, ASSETS, PICTURE_ACCEPTED, PICTURE_STACK, SMALL_CREST, withStack } from "./fixtures/stacks";
import { FORBIDDEN_WORDS } from "@/lib/design-import/report";
import { leaves } from "./walk";

/**
 * Rule 3: nothing on the tech pack page may read as settled. This scans every sentence the page can
 * show: the fixed text of the components, the view models and the registry, and every string in a
 * finished document. The words below are allowed only inside the sentences listed one by one, and
 * every one of those sentences says that a thing is NOT confirmed or checked.
 */
const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;

/** Each sentence (or part of one) that may hold one of the words, and why it is allowed. */
const ALLOWED: readonly string[] = [
  "To be confirmed", // the words for a missing value
  "to-be-confirmed", // the name of the status of a missing value, which is never shown
  "Nobody has checked this specification yet.", // says nothing has been checked
  "Not confirmed by anyone.", // ends the words that go with a proposal
  "not confirmed by anyone", // the same, inside a sentence
  "are still not confirmed by anyone", // the summary when no field is empty
  "are still to be confirmed", // says a note about what is missing
  "things to confirm", // a count of what is missing
  "thing to confirm",
  "Confirm each one", // asks the brand to confirm a suggestion
];

const ROOT = join(__dirname, "..", "..");
const listed = (dir: string, pattern: RegExp): string[] =>
  readdirSync(join(ROOT, dir))
    .filter((name) => pattern.test(name) && !/\.test\./.test(name))
    .map((name) => join(ROOT, dir, name));

const SOURCES = [
  ...listed("components/techpack", /\.tsx?$/),
  ...listed("lib/techpack", /\.ts$/),
  ...listed("lib/techpack/production", /\.ts$/),
  ...listed("lib/projects", /^tech-pack-.*\.ts$/),
  ...listed("lib/garment/registry", /\.ts$/),
  ...listed("lib/garment/registry/tops", /\.ts$/),
  join(ROOT, "lib/garment/provenance.ts"),
  join(ROOT, "lib/garment/tech-parts.ts"),
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

const withoutAllowed = (text: string): string => ALLOWED.reduce((left, phrase) => left.split(phrase).join(" "), text);

describe("the words that would make something look settled", () => {
  it("finds the files it scans", () => {
    expect(SOURCES.length).toBeGreaterThan(30);
    expect(SOURCES.flatMap(sentencesIn).length).toBeGreaterThan(300);
  });

  it("appear in no sentence of the page, its view models or the registry, except the sentences listed above", () => {
    for (const path of SOURCES) {
      for (const sentence of sentencesIn(path)) {
        expect(withoutAllowed(sentence), `${path}: ${sentence}`).not.toMatch(SETTLED);
      }
    }
  });

  it("do not need more allowed sentences than the ones that are used", () => {
    const all = SOURCES.flatMap(sentencesIn).join("\n");
    for (const phrase of ALLOWED) expect(all, `unused allowance: ${phrase}`).toContain(phrase);
  });

  it("would be caught in a sentence that says a thing is settled", () => {
    for (const bad of ["This is checked.", "All values are verified", "Approved by the factory", "The final spec", "Production ready", "All confirmed"]) {
      expect(withoutAllowed(bad)).toMatch(SETTLED);
    }
  });
});

describe("the words in a finished document and its summary", () => {
  const suggested = (): GarmentSpec => {
    let spec = fullDesign("polo");
    const steps = [
      { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "ai-suggested" },
      { type: "set-labelling", field: "origin", text: "Portugal", provenance: "read-from-image" },
    ];
    for (const step of steps) {
      const result = applyAction(spec, step);
      if (result.ok) spec = result.spec;
    }
    return spec;
  };

  it("are in no string of the document apart from the allowed sentences, for empty, full and suggested designs", () => {
    for (const spec of [start("polo"), fullDesign("polo"), suggested()]) {
      const pack = packFor(spec, { charts: CHARTS });
      const document = { ...pack, flats: { ...pack.flats, views: pack.flats.views.map((view) => ({ ...view, model: null })) } };
      for (const { path, leaf } of leaves(document)) {
        expect(withoutAllowed(String(leaf)), path).not.toMatch(SETTLED);
      }
    }
  });

  it("are in no name of a field of the document", () => {
    const keys = JSON.stringify(packFor(fullDesign("polo"))).match(/"[A-Za-z]+":/g) ?? [];
    expect(keys.filter((key) => SETTLED.test(key))).toEqual([]);
  });

  it("are in no label of the report of what is left to confirm", () => {
    const report = completenessReport(packFor(fullDesign("polo"), { charts: CHARTS }));
    const text = report.sections.flatMap((section) => section.items).map((item) => `${item.label} ${item.detail ?? ""}`);
    for (const line of text) expect(withoutAllowed(line)).not.toMatch(SETTLED);
  });
});

describe("the words of tech pack v2", () => {
  const complete = () => packFor(targetedJersey(), { production: completeProduction() });
  const sentences = (pack: ReturnType<typeof complete>): string[] =>
    leaves({ ...pack, flats: { ...pack.flats, views: pack.flats.views.map((view) => ({ ...view, model: null })) } }).map((entry) => String(entry.leaf));

  it("scan the production files too", () => {
    expect(SOURCES.some((path) => path.includes("production/readiness.ts"))).toBe(true);
  });

  it("hold none of the settled words in a document with every record, nor in one with none", () => {
    for (const pack of [complete(), packFor(targetedJersey())]) {
      for (const sentence of sentences(pack)) expect(withoutAllowed(sentence), sentence).not.toMatch(SETTLED);
    }
  });

  it("say who reviewed, accepted and signed, with a name and a date, and only from a record", () => {
    const text = sentences(complete());
    expect(text).toContain("Reviewed by Ana Reyes on 3 Oct 2026");
    expect(text).toContain("The strike-off was accepted by Sam Lee on 9 Oct 2026.");
    expect(text).toContain("Signed by 1 of 4 roles. The strike-off was accepted by Sam Lee on 9 Oct 2026.");
    const none = sentences(packFor(targetedJersey()));
    expect(none.filter((sentence) => /\b(reviewed by|accepted by|signed by)\b/i.test(sentence))).toEqual([]);
    expect(none).toContain("Draft pattern, not reviewed.");
  });

  it("hold none of the settled words, and never claim a picture was copied exactly, for a design from a stack or from a picture", () => {
    const stacked = packFor(withStack(ALL_KINDS_STACK), { production: { ...completeProduction(), assets: ASSETS } });
    const small = packFor(withStack(ALL_KINDS_STACK), { production: { ...completeProduction(), assets: [SMALL_CREST] } });
    const read = packFor(withStack(PICTURE_STACK), { production: { ...completeProduction(), assets: ASSETS, picture: PICTURE_ACCEPTED } });
    for (const pack of [stacked, small, read]) {
      for (const sentence of sentences(pack)) {
        expect(withoutAllowed(sentence), sentence).not.toMatch(SETTLED);
        expect(sentence, sentence).not.toMatch(FORBIDDEN_WORDS);
      }
    }
    expect(sentences(read).some((sentence) => /close reading/.test(sentence))).toBe(true);
  });

  it("call the list Ready for the factory and never production-ready", () => {
    const pack = complete();
    expect(pack.readiness.title).toBe("Ready for the factory");
    expect(JSON.stringify(pack)).not.toMatch(/production[- ]ready/i);
  });
});
