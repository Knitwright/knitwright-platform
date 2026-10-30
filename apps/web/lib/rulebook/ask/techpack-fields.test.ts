import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GAP_RULE_ID } from "../constants";
import { measurementsIn, measurementsOfRule } from "./sentences";
import { FROM_BASE, overviewFields, overviewSentence, ruleIdsOf, ruleOf, type ConstructionRow } from "./techpack-fields";

/**
 * The tech pack's overview sentences, drafted from the base article's construction table with provenance
 * `from_base` (plan v5 Z2). The table read here is the one the factory was sent,
 * `docs/spec/articles/JSY-SS-01/article.json`, so the test is against real rows and not invented ones.
 *
 * The reading that matters: every measurement in a drafted sentence is one its own row states. A tech-pack field
 * is what a factory sews from, so a number that entered it through drafting rather than through the base article
 * would be an invented measurement.
 */

const REPO = join(__dirname, "..", "..", "..", "..", "..");

type SourceRow = Readonly<{ n: number; seam: string; operation: string; spi?: string; rule?: string }>;

const CONSTRUCTION: readonly ConstructionRow[] = (
  JSON.parse(readFileSync(join(REPO, "docs", "spec", "articles", "JSY-SS-01", "article.json"), "utf8")) as {
    construction: readonly SourceRow[];
  }
).construction.map((row) => ({ step: row.n, seam: row.seam, operation: row.operation, spi: row.spi ?? null, ruleId: row.rule ?? "" }));

describe("the construction table this drafts from", () => {
  it("is the one the factory was sent, with a rule id on every row", () => {
    expect(CONSTRUCTION.length).toBeGreaterThan(8);
    expect(CONSTRUCTION.every((row) => row.seam !== "" && row.operation !== "")).toBe(true);
  });
});

describe("one overview sentence from one row", () => {
  it("is the row's own seam, operation and stitch density, and nothing else", () => {
    expect(overviewSentence({ step: 1, seam: "Shoulder seams", operation: "4-thread overlock (ISO 514)", spi: "12-14", ruleId: "R-CON-001" })).toBe(
      "Shoulder seams: 4-thread overlock (ISO 514). Stitch density 12-14.",
    );
  });

  it("says nothing about stitch density where the row states none", () => {
    const text = overviewSentence({ step: 8, seam: "Care label", operation: "Inserted in the left side seam", spi: "", ruleId: "R-LAB-002" });
    expect(text).toBe("Care label: Inserted in the left side seam.");
    expect(text).not.toMatch(/density/);
  });

  it("drafts nothing from a row with no seam or no operation, rather than half a sentence", () => {
    expect(overviewSentence({ step: 1, seam: "", operation: "Overlocked", spi: null, ruleId: "R-CON-001" })).toBeNull();
    expect(overviewSentence({ step: 1, seam: "Shoulder", operation: "  ", spi: null, ruleId: "R-CON-001" })).toBeNull();
  });

  it("leaves the operation's own punctuation alone", () => {
    expect(overviewSentence({ step: 1, seam: "Hem", operation: "25 mm turn-up.", spi: null, ruleId: "R-CON-007" })).toBe("Hem: 25 mm turn-up.");
  });
});

describe("the fields drafted from the whole table", () => {
  const fields = overviewFields(CONSTRUCTION);

  it("are in the table's own order, one per row, each with its row's rule", () => {
    expect(fields).toHaveLength(CONSTRUCTION.length);
    expect(fields.map((field) => field.key)).toEqual(CONSTRUCTION.map((row) => `construction-${row.step}`));
    expect(fields.map((field) => field.ruleId)).toEqual(CONSTRUCTION.map((row) => row.ruleId));
  });

  it("all say the words came from the base article", () => {
    expect(fields.every((field) => field.provenance === FROM_BASE)).toBe(true);
    expect(FROM_BASE).toBe("from_base");
  });

  it("state no measurement the row they were drafted from does not state", () => {
    const invented: string[] = [];
    for (const row of CONSTRUCTION) {
      const text = overviewSentence(row);
      if (text === null) continue;
      const stated = new Set([...measurementsOfRule(row.operation), ...measurementsOfRule(row.spi ?? "")]);
      invented.push(...measurementsIn(text).filter((measurement) => !stated.has(measurement)).map((found) => `${row.seam}: ${found}`));
    }
    expect(invented).toEqual([]);
  });

  it("carry R-GAP-000 rather than nothing where a row names no rule", () => {
    expect(ruleOf({ step: 1, seam: "A", operation: "B", spi: null, ruleId: "" })).toBe(GAP_RULE_ID);
    expect(ruleOf({ step: 1, seam: "A", operation: "B", spi: null, ruleId: "not a rule id" })).toBe(GAP_RULE_ID);
    expect(ruleOf({ step: 1, seam: "A", operation: "B", spi: null, ruleId: " R-CON-001 " })).toBe("R-CON-001");
  });

  it("list every rule the page has to read, each once", () => {
    const ids = ruleIdsOf(fields);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("R-CON-001");
    expect(ids.length).toBeLessThan(fields.length);
  });

  it("sort rows into the table's order whatever order they arrive in", () => {
    const shuffled = [...CONSTRUCTION].reverse();
    expect(overviewFields(shuffled).map((field) => field.key)).toEqual(overviewFields(CONSTRUCTION).map((field) => field.key));
  });
});
