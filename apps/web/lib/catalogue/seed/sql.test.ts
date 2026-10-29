import { describe, expect, it } from "vitest";
import { catalogue, readMigration } from "../fixtures/source";
import { literal, SEED_BEGIN, SEED_END, seedBlockOf, seedSql } from "./sql";

describe("the seed in the migration", () => {
  it("is exactly what article.json and the launch list give, so the two cannot drift", () => {
    const block = seedBlockOf(readMigration());
    expect(block, "the migration has its seed markers").toBeDefined();
    expect(block).toBe(seedSql(catalogue()));
  });

  it("puts every point of measure and every range of JSY-SS-01 in the migration", () => {
    const migration = readMigration();
    const [jersey] = catalogue();
    for (const pom of jersey!.poms) expect(migration).toContain(`'${pom.letter}', '${pom.code}'`);
    for (const parameter of jersey!.parameters) {
      expect(migration).toContain(`'${parameter.key}', 'range', ${parameter.min}, ${parameter.max}, ${parameter.step}`);
    }
  });

  it("is the same text every time", () => {
    expect(seedSql(catalogue())).toBe(seedSql(catalogue()));
  });

  it("writes nothing for an empty catalogue", () => {
    expect(seedSql([])).toBe("");
  });
});

describe("a SQL literal", () => {
  it("quotes text, arrays and JSON safely", () => {
    expect(literal("Knitwright's draft")).toBe("'Knitwright''s draft'");
    expect(literal(["a", 'say "hi"', "back\\slash", "it's"])).toBe(`'{"a","say \\"hi\\"","back\\\\slash","it''s"}'`);
    expect(literal([])).toBe("'{}'");
    expect(literal({ note: "it's" })).toBe(`'{"note":"it''s"}'::jsonb`);
  });

  it("writes numbers, booleans and null plainly, and refuses a number that is not one", () => {
    expect([literal(1.5), literal(-30), literal(true), literal(false), literal(null)]).toEqual(["1.5", "-30", "true", "false", "null"]);
    expect(() => literal(Number.NaN)).toThrow();
  });
});

describe("finding the seed block", () => {
  it("returns undefined without both markers in order", () => {
    expect(seedBlockOf("no seed here")).toBeUndefined();
    expect(seedBlockOf(`${SEED_END}\n${SEED_BEGIN}\n`)).toBeUndefined();
    expect(seedBlockOf(`${SEED_BEGIN}\nselect 1;\n${SEED_END}\n`)).toBe("select 1;\n");
  });
});
