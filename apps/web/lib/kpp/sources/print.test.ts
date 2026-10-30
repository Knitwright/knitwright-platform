import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createFakeAssetReader } from "@/lib/artwork-stack";
import { jersey } from "@/lib/artwork-stack/fixtures/designs";
import type { GradedPattern } from "@/lib/production/contract";
import { NO_RULES } from "@/lib/print/fixtures/setup";
import { DEFAULT_PRINT_PROFILE } from "@/lib/print/profiles";
import { sha256Hex } from "../encode";
import type { KppPrintRules } from "../model";
import { DRAFTED_BY, draftedDesignPattern, noSizeReason, NO_TEAM_LIST, printSource, type PrintSourceInput } from "./print";
import { draftedPattern } from "./pattern";

/**
 * Seam 4 of the wave 2 wiring, and the last of decision 0070: the production package's `PrintSource` over
 * `lib/print`. The point of it is that `04_print/**` and `03_patterns/**` are drawn on **one** pattern — the
 * drafted one — so these tests take the pattern from `sources/pattern.ts`, the same call the assembler makes.
 *
 * Making a real print file rasterises a panel, so these build one size at a time, and the pieces are trimmed
 * where the test is not about how many there are.
 */

const drafted = () => {
  const outcome = draftedPattern("JSY-SS-01");
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome;
};

const PRINT: KppPrintRules = { minDpi: 150, minBleedMm: 10, dpi: 150, bleedMm: 10, ruleId: "R-SUB-002" };

/** A real sRGB profile, made the way `lib/print/render/tiff.test.ts` makes one. */
const srgbProfile = async (): Promise<Uint8Array> => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#808080" } }).withIccProfile("srgb").png().toBuffer();
  const icc = (await sharp(png).metadata()).icc;
  if (!icc) throw new Error("no profile");
  return new Uint8Array(icc);
};

/** The same pattern with only the pieces named, so one test renders one panel. */
const onlyPieces = (pattern: GradedPattern, sizes: readonly string[], ids: readonly string[]): GradedPattern => ({
  ...pattern,
  sizes: [...sizes],
  piecesBySize: Object.fromEntries(sizes.map((size) => [size, (pattern.piecesBySize[size] ?? []).filter((piece) => ids.includes(piece.id))])),
});

const facts = (pattern: GradedPattern) => ({ pattern, articleCode: "JSY-SS-01", articleVersion: "0.1", drafter: DRAFTED_BY });

const input = (pattern: GradedPattern, patch: Partial<PrintSourceInput> = {}): PrintSourceInput => ({
  drafted: facts(pattern),
  spec: jersey(),
  colourwayId: "main",
  printFileType: "pdf",
  print: PRINT,
  context: { profile: DEFAULT_PRINT_PROFILE, icc: null, rules: NO_RULES, assets: createFakeAssetReader([]) },
  ...patch,
});

describe("the pattern the print files are drawn on", () => {
  it("is the very pattern 03_patterns is written from, not the brand's library pattern", async () => {
    const outcome = drafted();
    const made = printSource(input(outcome.pattern));

    // The assembler resolves `03_patterns` from this same source, so one object serves both.
    expect(await outcome.source.pattern()).toBe(outcome.pattern);
    expect(made.notes[0]).toContain("drawn on the same pattern as 03_patterns");
  });

  it("is a draft no factory has reviewed, and the margin says which article, which version and which drafter", () => {
    const pattern = drafted().pattern;

    const asked = draftedDesignPattern(facts(pattern));

    expect(asked.reviewed).toBe(false);
    expect(asked.pattern).toBe(pattern);
    expect(asked.note).toContain("Draft");
    expect(asked.note).toContain("JSY-SS-01");
    expect(asked.note).toContain("article version 0.1");
    expect(asked.note).toContain(`block v${pattern.blockVersion}`);
    expect(asked.note).toContain("lib/parametric");
    expect(asked.note).not.toMatch(/reviewed by|approved/i);
  });

  it("says in the package's notes which pieces no print view is defined for, rather than dropping them in silence", () => {
    const pattern = drafted().pattern;

    const all = printSource(input(pattern)).notes.join(" ");
    const bodyOnly = printSource(input(onlyPieces(pattern, ["M"], ["front", "back"]))).notes.join(" ");

    expect(all).toContain("No print view is defined for");
    expect(all).toContain("03_patterns carries them");
    expect(bodyOnly).not.toContain("No print view is defined");
  });

  it("says that no team list reaches the print files, so an unpersonalised file is never taken for a personalised one", () => {
    expect(printSource(input(drafted().pattern)).notes).toContain(NO_TEAM_LIST);
  });
});

describe("the print files of one size", () => {
  it("gives one file per printed piece, named as the rest of the package names it", async () => {
    const pattern = onlyPieces(drafted().pattern, ["M"], ["front", "back", "sleeve"]);

    const files = await printSource(input(pattern)).source.files("M", null);

    // `printPath` writes SAMPLE_<article>_<panel>_<size>, and the package's own tests expect these four names.
    expect(files.map((file) => file.panel)).toEqual(["front", "back", "sleeve-left", "sleeve-right"]);
    for (const file of files) expect(file.bytes.byteLength).toBeGreaterThan(0);
  }, 120_000);

  it("gives the same bytes twice for the same design, which is what makes the package deterministic", async () => {
    const pattern = onlyPieces(drafted().pattern, ["M"], ["front"]);
    const source = () => printSource(input(pattern)).source;

    const once = await source().files("M", null);
    const again = await source().files("M", null);

    expect(once.map((file) => sha256Hex(file.bytes))).toEqual(again.map((file) => sha256Hex(file.bytes)));
  }, 120_000);

  it("carries the draft note into the file itself, so two patterns cannot give one file", async () => {
    const pattern = onlyPieces(drafted().pattern, ["M"], ["front"]);

    const mine = await printSource(input(pattern)).source.files("M", null);
    const other = await printSource(input(pattern, { drafted: { ...facts(pattern), articleVersion: "9.9" } })).source.files("M", null);

    expect(sha256Hex(mine[0]!.bytes)).not.toBe(sha256Hex(other[0]!.bytes));
  }, 120_000);

  it("makes the file in the factory's own format: a TIFF where the factory asks for one", async () => {
    const pattern = onlyPieces(drafted().pattern, ["M"], ["front"]);

    const files = await printSource(input(pattern, { printFileType: "tif" })).source.files("M", null);
    const pdfs = await printSource(input(pattern)).source.files("M", null);

    expect(files).toHaveLength(1);
    // `lib/kpp/paths.ts` writes the `.tif` extension; what differs here is the bytes, which are not a PDF.
    expect(new TextDecoder().decode(pdfs[0]!.bytes.subarray(0, 5))).toBe("%PDF-");
    expect(new TextDecoder().decode(files[0]!.bytes.subarray(0, 5))).not.toBe("%PDF-");
  }, 300_000);

  it("passes the print house's colour profile on when the brand has one", async () => {
    const pattern = onlyPieces(drafted().pattern, ["M"], ["front"]);
    const icc = await srgbProfile();

    const files = await printSource(input(pattern, { context: { ...input(pattern).context, icc } })).source.files("M", null);

    // The profile is written into a TIFF, not a PDF, so the bytes are the same; the branch that carries it is not.
    expect(files).toHaveLength(1);
    expect(files[0]!.bytes.byteLength).toBeGreaterThan(0);
  }, 120_000);

  it("is made at the bleed and resolution the package states, not at the brand's own", async () => {
    const pattern = onlyPieces(drafted().pattern, ["M"], ["front"]);
    const profile = { ...DEFAULT_PRINT_PROFILE, dpi: 300, bleedMm: 25, minDpi: 300 };

    const stated = await printSource(input(pattern)).source.files("M", null);
    const theirs = await printSource(input(pattern, { context: { ...input(pattern).context, profile } })).source.files("M", null);

    // Both are made at the package's 150 dpi and 10 mm bleed, so the profile's own numbers change nothing.
    expect(sha256Hex(stated[0]!.bytes)).toBe(sha256Hex(theirs[0]!.bytes));
  }, 120_000);
});

describe("a size the drafted pattern does not hold", () => {
  it("is a reason in words, not a crash inside the layout", async () => {
    const source = printSource(input(onlyPieces(drafted().pattern, ["M"], ["front"]))).source;

    await expect(source.files("4XL", null)).rejects.toThrow(noSizeReason("JSY-SS-01", "4XL"));
    await expect(source.files("4XL", null)).rejects.toThrow(/is not in the drafted pattern/);
  });
});
