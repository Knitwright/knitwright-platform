import { describe, expect, it } from "vitest";
import { mappingRows } from "./fixtures/source";
import { mappingRow, rowOf, toMapping } from "./rows";
import { OPTION_CODE_MAP_SEED } from "./seed/rows";

describe("a row of the map", () => {
  it("round-trips every seeded row through the shape the database holds", () => {
    const rows = mappingRows();
    expect(rows).toHaveLength(OPTION_CODE_MAP_SEED.length);
    expect(rows.map((row) => toMapping("JSY-SS-01", mappingRow.parse(row)))).toEqual(OPTION_CODE_MAP_SEED);
  });

  it("refuses a row whose rule id is not a rule id", () => {
    expect(mappingRow.safeParse({ ...rowOf(OPTION_CODE_MAP_SEED[0]!, 0), rule_id: "gap" }).success).toBe(false);
  });

  it("refuses a kind the map does not know, and a source with no quote", () => {
    const row = rowOf(OPTION_CODE_MAP_SEED[0]!, 0);
    expect(mappingRow.safeParse({ ...row, kind: "guessed" }).success).toBe(false);
    expect(mappingRow.safeParse({ ...row, sources: [{ file: "f", quote: "" }] }).success).toBe(false);
  });

  it("takes the article code from the read, because the row holds the article's id", () => {
    expect(toMapping("TEE-TR-01", mappingRow.parse(rowOf(OPTION_CODE_MAP_SEED[0]!, 0))).articleCode).toBe("TEE-TR-01");
  });
});
