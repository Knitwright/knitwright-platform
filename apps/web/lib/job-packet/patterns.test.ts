import { describe, expect, it } from "vitest";
import type { Batch, OpsOrder } from "@/lib/ops/rows";
import { noPatterns, NO_PATTERNS_NOTE, type PatternSource } from "./patterns";

const batch: Batch = { id: "11111111-1111-4111-8111-111111111111", factoryProfileId: "knitwright-default", fabricKey: "mesh-140", articleId: "crew-tee", cutoffAt: "2026-11-06T17:00:00.000Z" };
const orders: readonly OpsOrder[] = [];

describe("noPatterns", () => {
  it("adds no file, because guessing at a pattern would be worse than sending none", async () => {
    expect(await noPatterns.filesFor(batch, orders)).toEqual({ files: [], note: NO_PATTERNS_NOTE });
  });

  it("says in plain words why the ZIP has none, and that Knitwright sends them another way", () => {
    expect(noPatterns.note).toBe(NO_PATTERNS_NOTE);
    expect(NO_PATTERNS_NOTE).toContain("not in this ZIP yet");
    expect(NO_PATTERNS_NOTE).toContain("separately");
  });
});

describe("the PatternSource seam", () => {
  /**
   * `drafted-patterns.ts` is the real source. A test double here proves the seam takes a source that adds
   * files, and that such a source still says what the folder holds.
   */
  const graded: PatternSource = {
    filesFor: async (b, os) => ({
      files: os.map((order) => ({ path: `${order.externalRef}/dxf_aama/${b.articleId}-M.dxf`, bytes: new Uint8Array([0]) })),
      note: "patterns/: the files for this batch.",
    }),
  };

  it("takes a source that names a file per order, under the batch's article", async () => {
    const order = { externalRef: "STORE-1" } as OpsOrder;

    const set = await graded.filesFor(batch, [order]);

    expect(set.files.map((f) => f.path)).toEqual(["STORE-1/dxf_aama/crew-tee-M.dxf"]);
    expect(set.note).toContain("patterns/");
  });
});
