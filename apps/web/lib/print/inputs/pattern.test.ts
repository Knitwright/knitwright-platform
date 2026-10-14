import { describe, expect, it } from "vitest";
import { BLOCK_ID, BRAND, blockRow, libraryClient, sizeRows } from "../fixtures/library-client";
import { gradedPatternSchema } from "@/lib/production/contract";
import { gradedFromDetail, loadDesignPattern, NO_LIBRARY_PATTERN, PATTERN_CHANGED, PATTERN_NOT_FOUND } from "./pattern";

const review = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", block_id: BLOCK_ID, reviewer_name: "Sam Cutter", reviewer_role: "technician", note: "", reviewed_on: "2026-10-12" };
const tables = (over: Record<string, Record<string, unknown>[]> = {}) => ({ pattern_blocks: [blockRow()], pattern_block_sizes: sizeRows(), pattern_reviews: [], ...over });

describe("loadDesignPattern", () => {
  it("builds the graded pattern from the library's stored sizes, one size run in the library's order", async () => {
    const found = await loadDesignPattern(libraryClient(tables()), BRAND, { typeId: "team-jersey" });
    if (!found.ok) throw new Error(found.reason);
    expect(gradedPatternSchema.safeParse(found.pattern).success).toBe(true);
    expect(found.pattern).toMatchObject({ blockId: BLOCK_ID, blockVersion: 3 });
    expect(found.pattern.sizes).toEqual(["XS", "S", "M", "L", "XL", "2XL", "3XL"]);
    expect(found.reviewed).toBe(false);
    expect(found.note).toBe("Pattern: Team jersey, version 3. Draft pattern, not reviewed.");
  });

  it("says who reviewed it once a person has", async () => {
    const found = await loadDesignPattern(libraryClient(tables({ pattern_reviews: [review] })), BRAND, { typeId: "team-jersey" });
    if (!found.ok) throw new Error(found.reason);
    expect(found.reviewed).toBe(true);
    expect(found.note).toBe("Pattern: Team jersey, version 3. Reviewed by Sam Cutter (technician) on 2026-10-12.");
  });

  it("takes the newest pattern for the garment when no pattern is named", async () => {
    const older = blockRow({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", version: 2, created_at: "2026-10-01T10:00:00Z" });
    const found = await loadDesignPattern(libraryClient(tables({ pattern_blocks: [blockRow(), older] })), BRAND, { typeId: "team-jersey" });
    expect(found.ok && found.pattern.blockVersion).toBe(3);
  });

  it("takes the pattern that is named, at the version asked, and says when it has changed", async () => {
    const client = libraryClient(tables());
    expect((await loadDesignPattern(client, BRAND, { typeId: "crew-tee", blockId: BLOCK_ID, blockVersion: 3 })).ok).toBe(true);
    expect(await loadDesignPattern(client, BRAND, { typeId: "team-jersey", blockId: BLOCK_ID, blockVersion: 2 })).toEqual({ ok: false, reason: PATTERN_CHANGED });
    expect(await loadDesignPattern(client, BRAND, { typeId: "team-jersey", blockId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" })).toEqual({ ok: false, reason: PATTERN_NOT_FOUND });
  });

  it("says so when the library has no pattern for the garment, or only a knitting programme", async () => {
    expect(await loadDesignPattern(libraryClient(tables({ pattern_blocks: [] })), BRAND, { typeId: "team-jersey" })).toEqual({ ok: false, reason: NO_LIBRARY_PATTERN });
    expect(await loadDesignPattern(libraryClient(tables({ pattern_blocks: [blockRow({ kind: "knit-programme" })] })), BRAND, { typeId: "team-jersey" })).toEqual({ ok: false, reason: NO_LIBRARY_PATTERN });
  });

  it("refuses a pattern whose sizes do not hold pieces", async () => {
    const found = await loadDesignPattern(libraryClient(tables({ pattern_block_sizes: [] })), BRAND, { typeId: "team-jersey" });
    expect(found).toEqual({ ok: false, reason: PATTERN_NOT_FOUND });
  });
});

describe("gradedFromDetail", () => {
  it("leaves out a size with no pieces instead of inventing it", () => {
    const rows = sizeRows().map((row, at) => (at === 0 ? { ...row, pieces: [] } : row));
    const detail = { block: { id: BLOCK_ID, version: 3 }, sizes: rows.map((row) => ({ size: row.size_label, position: row.position, pieces: row.pieces })) };
    const graded = gradedFromDetail(detail as never);
    expect(graded?.sizes).not.toContain("XS");
    expect(graded?.sizes).toHaveLength(6);
  });
});
