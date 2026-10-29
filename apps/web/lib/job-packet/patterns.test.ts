import { describe, expect, it } from "vitest";
import type { Batch, OpsOrder } from "@/lib/ops/rows";
import { noPatterns, NO_PATTERNS_NOTE, type PatternSource } from "./patterns";

const batch: Batch = { id: "11111111-1111-4111-8111-111111111111", factoryProfileId: "knitwright-default", fabricKey: "mesh-140", articleId: "crew-tee", cutoffAt: "2026-11-06T17:00:00.000Z" };
const orders: readonly OpsOrder[] = [];

describe("noPatterns", () => {
  it("adds no file, because guessing at a pattern would be worse than sending none", async () => {
    expect(await noPatterns.filesFor(batch, orders)).toEqual([]);
  });

  it("says in plain words why the ZIP has none, and that Knitwright sends them another way", () => {
    expect(noPatterns.note).toBe(NO_PATTERNS_NOTE);
    expect(NO_PATTERNS_NOTE).toContain("not in this ZIP yet");
    expect(NO_PATTERNS_NOTE).toContain("separately");
  });
});

describe("the PatternSource seam", () => {
  /**
   * The production package assembler (X5) fills this in a later wave. A test double here proves the seam
   * takes a source that does add files, and that such a source carries no note.
   */
  const graded: PatternSource = {
    note: null,
    filesFor: async (b, os) => os.map((order) => ({ path: `${order.externalRef}/dxf_aama/${b.articleId}-M.dxf`, bytes: new Uint8Array([0]) })),
  };

  it("takes a source that names a file per order, under the batch's article", async () => {
    const order = { externalRef: "STORE-1" } as OpsOrder;

    const files = await graded.filesFor(batch, [order]);

    expect(files.map((f) => f.path)).toEqual(["STORE-1/dxf_aama/crew-tee-M.dxf"]);
    expect(graded.note).toBeNull();
  });
});
