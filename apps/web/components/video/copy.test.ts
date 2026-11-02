import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as copy from "./copy";

/**
 * The words and the markup of the video studio, read as a whole.
 *
 * Rule 3 of the house wording rules (`lib/techpack/wording.test.ts`): nothing may read as settled. The
 * one word this studio needs is "confirmed", and it is only ever used to say a licence is **not**
 * confirmed, which is the same exception the tech pack's own list allows.
 *
 * It also holds the two things L1 found the hard way: secondary text in the launch chrome is
 * `text-ink-2` and never `text-chalk-muted`, which fails contrast on glass; and a panel is a default
 * export taking exactly `LaunchPanelProps`, or the shell cannot load it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const LIB = join(HERE, "..", "..", "lib", "media", "video");

const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;

/** Each sentence that may hold one of those words, and why. Every one says a thing is NOT settled. */
const ALLOWED: readonly string[] = [
  "Commercial licence not confirmed",
  "not confirmed", // inside a longer sentence about a licence nobody has read
  "no licence, price or waiting time here has been reviewed by anyone",
  // The checker's own verdict, from the studio clip of decision 0058, which predates this workstream.
  "passed the check",
];

/** A value, not a sentence: a one-word literal is a key or a verdict and is never shown as prose. */
const isSentence = (text: string): boolean => /\s/.test(text.trim());

const sources = (dir: string): string[] =>
  readdirSync(dir)
    .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
    .map((name) => join(dir, name));

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

describe("the words of the video studio", () => {
  const files = [...sources(HERE), ...sources(LIB)];

  it("finds the files it reads", () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files.flatMap(sentencesIn).length).toBeGreaterThan(200);
  });

  it("says nothing that reads as checked, approved or final", () => {
    for (const path of files) {
      for (const sentence of sentencesIn(path).filter(isSentence)) {
        expect(withoutAllowed(sentence), `${path}: ${sentence}`).not.toMatch(SETTLED);
      }
    }
  });

  it("says plainly, wherever a credit figure is shown, that the figures are placeholders", () => {
    expect(copy.PLACEHOLDER_NOTICE).toMatch(/placeholder/);
    expect(copy.PLACEHOLDER_NOTICE).toMatch(/not prices/);
  });

  it("tells somebody whose run failed what happened, what it cost and what to do", () => {
    expect(copy.FAILED_TITLE).toMatch(/\w/);
    expect(copy.FAILED_COST_LINE).toMatch(/given back/);
    expect(copy.FAILED_WHAT_NEXT).toMatch(/Try/);
  });

  it("labels a clip as something a model made", () => {
    expect(copy.GENERATED_BADGE).toBe("AI-generated");
    expect(copy.GENERATED_BADGE_LINE).toMatch(/the platform drew/);
  });
});

describe("the markup of the video studio", () => {
  const tsx = sources(HERE).filter((path) => path.endsWith(".tsx"));

  it("finds the components", () => {
    expect(tsx.map((path) => path.split("/").pop())).toEqual(expect.arrayContaining(["AiVideoPanel.tsx", "VideoPlayer.tsx", "VideoStudio.tsx"]));
  });

  it("uses text-ink-2 for secondary text, never the one that fails contrast on glass", () => {
    for (const path of tsx) {
      const text = readFileSync(path, "utf8");
      expect(text, path).not.toContain("text-chalk-muted");
    }
    expect(readFileSync(join(HERE, "AiVideoPanel.tsx"), "utf8")).toContain("text-ink-2");
  });

  it("takes no focus ring away", () => {
    for (const path of tsx) expect(readFileSync(path, "utf8"), path).not.toMatch(/outline-none|focus:outline-0/);
  });

  it("never autoplays a clip, and always starts it muted", () => {
    const code = readFileSync(join(HERE, "VideoPlayer.tsx"), "utf8").replaceAll(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/autoPlay/);
    expect(code).toContain("muted");
  });

  it("is a default export taking exactly the shell's panel props, so the shell can load it", () => {
    expect(readFileSync(join(HERE, "AiVideoPanel.tsx"), "utf8")).toContain("export default function AiVideoPanel({ context, commands }: LaunchPanelProps)");
  });

  it("stacks on a phone and lays out in columns from lg up, as the launch chrome already does", () => {
    const text = readFileSync(join(HERE, "AiVideoPanel.tsx"), "utf8");
    expect(text).toContain("flex flex-col");
    expect(text).toContain("flex-wrap");
  });
});
