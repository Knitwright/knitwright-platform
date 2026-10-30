import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Batch, OpsOrder } from "@/lib/ops/rows";
import { draftedPatterns, patternsFor } from "./drafted-patterns";

/**
 * Seam 4 of the wave 2 wiring: the factory ZIP's `patterns/` folder from the production package's writers
 * over the graded drafter. `football-shirt` is the registry type the catalogue maps to JSY-SS-01, the one
 * article with a drafting script; `crew-tee` maps to TEE-TR-01, which has none.
 */

const batch = (articleId: string): Batch => ({
  id: "11111111-1111-4111-8111-111111111111",
  factoryProfileId: "knitwright-default",
  fabricKey: "mesh-140",
  articleId,
  cutoffAt: "2026-11-06T17:00:00.000Z",
});

const order = (sizes: Readonly<Record<string, number>>): OpsOrder => ({ externalRef: "STORE-1", sizes } as OpsOrder);

const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const paths = (set: { files: readonly { path: string }[] }): string[] => set.files.map((file) => file.path);

describe("the pattern files of a batch", () => {
  const set = patternsFor(batch("football-shirt"), [order({ M: 3, L: 2 })]);

  it("names a DXF, a 1:1 PDF and an SVG for each size the orders ask for, in grading order, and one nest", () => {
    expect(paths(set)).toEqual([
      "dxf_aama/JSY-SS-01_M.dxf",
      "pdf_1to1/JSY-SS-01_M.pdf",
      "svg/JSY-SS-01_M.svg",
      "dxf_aama/JSY-SS-01_L.dxf",
      "pdf_1to1/JSY-SS-01_L.pdf",
      "svg/JSY-SS-01_L.svg",
      "dxf_aama/JSY-SS-01_nest.dxf",
    ]);
  });

  it("writes a DXF that says it is a draft nobody has reviewed, a real PDF and an SVG in millimetres", () => {
    const dxf = set.files.find((file) => file.path === "dxf_aama/JSY-SS-01_M.dxf")!;
    expect(text(dxf.bytes)).toContain("Knitwright draft for factory review, not reviewed: JSY-SS-01 v0.1");
    expect(text(set.files.find((file) => file.path === "pdf_1to1/JSY-SS-01_M.pdf")!.bytes).slice(0, 5)).toBe("%PDF-");
    expect(text(set.files.find((file) => file.path === "svg/JSY-SS-01_M.svg")!.bytes)).toContain("<svg");
  });

  it("tells the factory what the folder holds and that it is not a factory-checked master pattern", () => {
    expect(set.note).toContain("the graded block of base article JSY-SS-01");
    expect(set.note).toContain("at the article's own default parameters");
    expect(set.note).toContain("v-notch");
    expect(set.note).toContain("not a factory-checked master pattern");
  });

  it("gives the same bytes twice, for the same batch and the same orders", () => {
    const again = patternsFor(batch("football-shirt"), [order({ M: 3, L: 2 })]);
    expect(paths(again)).toEqual(paths(set));
    expect(again.files.map((file) => sha(file.bytes))).toEqual(set.files.map((file) => sha(file.bytes)));
    expect(again.note).toBe(set.note);
  });

  it("is the source the factory's ZIP takes", async () => {
    const asked = await draftedPatterns.filesFor(batch("football-shirt"), [order({ M: 1 })]);
    expect(paths(asked)).toEqual(["dxf_aama/JSY-SS-01_M.dxf", "pdf_1to1/JSY-SS-01_M.pdf", "svg/JSY-SS-01_M.svg", "dxf_aama/JSY-SS-01_nest.dxf"]);
  });
});

describe("a batch the drafter has no pattern for", () => {
  it("says a size the article does not grade has no pattern, and still sends the sizes it does grade", () => {
    const set = patternsFor(batch("football-shirt"), [order({ M: 1, "5XL": 2 })]);

    expect(paths(set)).toEqual(["dxf_aama/JSY-SS-01_M.dxf", "pdf_1to1/JSY-SS-01_M.pdf", "svg/JSY-SS-01_M.svg", "dxf_aama/JSY-SS-01_nest.dxf"]);
    expect(set.note).toContain("No pattern for size 5XL: the article does not grade that size.");
  });

  it("adds nothing when the article grades none of the sizes asked for, and says which", () => {
    const set = patternsFor(batch("football-shirt"), [order({ "5XL": 2, "6XL": 1 })]);

    expect(set.files).toEqual([]);
    expect(set.note).toContain("it does not grade size 5XL, 6XL");
    expect(set.note).toContain("sends the pattern files for this batch separately");
  });

  it("says the garment type is mapped to no base article yet, rather than drawing one", () => {
    const set = patternsFor(batch("bobble-hat"), [order({ M: 1 })]);

    expect(set.files).toEqual([]);
    expect(set.note).toContain("bobble-hat is not mapped to a base article in the catalogue");
  });

  it("passes on the drafter's reason for an article with no drafting script", () => {
    const set = patternsFor(batch("crew-tee"), [order({ M: 1 })]);

    expect(set.files).toEqual([]);
    expect(set.note).toContain("No patterns for base article TEE-TR-01");
    expect(set.note).toContain("no drafting script for TEE-TR-01");
  });

  it("says so when no order in the batch asks for a size", () => {
    const set = patternsFor(batch("football-shirt"), [order({ M: 0 })]);

    expect(set.files).toEqual([]);
    expect(set.note).toContain("no order in this batch asks for a size");
  });
});
