import { describe, expect, it } from "vitest";
import { readMigration } from "../fixtures/source";
import { OPTION_CODE_MAP_SEED } from "./rows";
import { SEED_BEGIN, SEED_END, seedBlockOf, seedSql } from "./sql";

describe("the seed in the migration", () => {
  it("is exactly what the map's rows give, so the database cannot drift from the published sources", () => {
    const block = seedBlockOf(readMigration());
    expect(block, "the migration has its seed markers").toBeDefined();
    expect(block).toBe(seedSql(OPTION_CODE_MAP_SEED));
  });

  it("writes every mapped code and every gap into the migration", () => {
    const migration = readMigration();
    for (const row of OPTION_CODE_MAP_SEED) {
      if (row.optionCode !== null) expect(migration).toContain(`'${row.optionGroup ?? ""}', '${row.optionCode}', 'mapped'`);
      else expect(migration).toContain(`'${row.kind}'`);
    }
  });

  it("is the same text every time", () => {
    expect(seedSql(OPTION_CODE_MAP_SEED)).toBe(seedSql(OPTION_CODE_MAP_SEED));
  });

  it("writes nothing for an empty map", () => {
    expect(seedSql([])).toBe("");
  });

  it("quotes a source's own apostrophes so the seed is valid SQL", () => {
    const row = { ...OPTION_CODE_MAP_SEED[0]!, note: "it's", sources: [{ file: "f", quote: "it's" }] };
    expect(seedSql([row])).toContain("''s");
  });
});

describe("finding the seed block", () => {
  it("returns undefined without both markers in order", () => {
    expect(seedBlockOf("no seed here")).toBeUndefined();
    expect(seedBlockOf(`${SEED_END}\n${SEED_BEGIN}\n`)).toBeUndefined();
    expect(seedBlockOf(`${SEED_BEGIN}\nselect 1;\n${SEED_END}\n`)).toBe("select 1;\n");
  });
});
