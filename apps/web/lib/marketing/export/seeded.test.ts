import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RULE_ID } from "@/lib/rulebook/constants";
import { DPI_CHOICES } from "@/lib/launch";
import { SEEDED_EXPORT_TARGETS, SEEDED_WATERMARK_RULES } from "./seeded";
import { dpiOffered, formatsOffered, quickTargets, fullTargets, ruleForPlan, targetByKey } from "./targets";

/**
 * The migration's own rows, read out of the file. This is what makes two copies of one table safe:
 * change the migration without changing `seeded.ts`, or the other way round, and this fails.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
const migration = (): string => readFileSync(join(REPO_ROOT, "supabase", "migrations", "20261201060000_marketing_studio.sql"), "utf8");

/** The value tuples of the insert into `table`, as the text between each pair of brackets. */
function insertedRows(table: string): string[] {
  const text = migration();
  const at = text.indexOf(`insert into public.${table}`);
  expect(at, `no insert into ${table}`).toBeGreaterThan(-1);
  // The statement ends at a semicolon that ends a line: one of the notes has a semicolon in it.
  const statement = text.slice(at, text.indexOf(";\n", at));
  // One row a line, each wrapped in brackets. A label of its own may hold brackets, so the line is
  // taken whole and only its outer pair is stripped.
  return statement
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line.startsWith("('") && line.endsWith(")"))
    .map((line) => line.slice(1, -1));
}

/** One inserted row's cells, with the quotes taken off and SQL's doubled quote put back. */
const cells = (row: string): string[] =>
  row.split(/,(?=(?:[^']*'[^']*')*[^']*$)/).map((cell) => cell.trim().replace(/^'|'$/g, "").replaceAll("''", "'"));

describe("the export targets in code against the migration's rows", () => {
  const rows = insertedRows("marketing_export_targets").map(cells);

  it("has the same keys, in the same order", () => {
    expect(rows.map((row) => row[0])).toEqual(SEEDED_EXPORT_TARGETS.map((one) => one.key));
  });

  it("has the same label, lead, format, colour space, resolution, scale, quick flag, order and note", () => {
    for (const [index, row] of rows.entries()) {
      const target = SEEDED_EXPORT_TARGETS[index]!;
      const [key, label, lead, format, space, dpi, scale, quick, sort, note] = row;
      expect([label, lead, format, space], key).toEqual([target.label, target.lead, target.format, target.colourSpace]);
      expect([Number(dpi), Number(scale), quick === "true", Number(sort)], key).toEqual([target.dpi, target.scale, target.quick, target.sort]);
      expect(note, key).toBe(target.note);
    }
  });

  it("offers the spec's quick export at 1x, 2x and 3x, and nothing else as one click", () => {
    expect(quickTargets(SEEDED_EXPORT_TARGETS).map((one) => one.scale)).toEqual([1, 2, 3]);
    expect(quickTargets(SEEDED_EXPORT_TARGETS).every((one) => one.format === "png")).toBe(true);
    expect(fullTargets(SEEDED_EXPORT_TARGETS)).toHaveLength(5);
  });

  it("offers the four formats of the spec and the two resolutions L1's panel reads", () => {
    expect(formatsOffered(SEEDED_EXPORT_TARGETS)).toEqual(["png", "jpeg", "svg", "pdf"]);
    expect(dpiOffered(SEEDED_EXPORT_TARGETS)).toEqual([...DPI_CHOICES]);
  });

  it("finds a target by its key, and nothing by a key that is not there", () => {
    expect(targetByKey(SEEDED_EXPORT_TARGETS, "png-2x")!.scale).toBe(2);
    expect(targetByKey(SEEDED_EXPORT_TARGETS, "nope")).toBeNull();
  });

  it("carries a rule id and a note saying nobody reviewed the figures", () => {
    for (const one of SEEDED_EXPORT_TARGETS) {
      expect(one.ruleId).toMatch(RULE_ID);
      expect(one.note.length).toBeGreaterThan(10);
    }
  });
});

describe("the watermark rules in code against the migration's rows", () => {
  const rows = insertedRows("marketing_watermark_rules").map(cells);

  it("is the spec's one sentence as two rows, the same in both places", () => {
    expect(rows).toHaveLength(2);
    for (const [index, row] of rows.entries()) {
      const rule = SEEDED_WATERMARK_RULES[index]!;
      const [plan, label, watermarked, maxDpi, note] = row;
      expect([plan, label, watermarked === "true", Number(maxDpi), note]).toEqual([rule.plan, rule.label, rule.watermarked, rule.maxDpi, rule.note]);
    }
  });

  it("watermarks the free plan and stops it at the lower resolution, as the spec says", () => {
    const free = ruleForPlan(SEEDED_WATERMARK_RULES, "free")!;
    const paid = ruleForPlan(SEEDED_WATERMARK_RULES, "paid")!;

    expect(free.watermarked).toBe(true);
    expect(paid.watermarked).toBe(false);
    expect(paid.maxDpi).toBeGreaterThan(free.maxDpi);
    expect(paid.maxDpi).toBe(300);
  });

  it("knows nothing about a plan with no row", () => {
    expect(ruleForPlan(SEEDED_WATERMARK_RULES, "free" as "paid")).not.toBeNull();
    expect(ruleForPlan([], "free")).toBeNull();
  });
});
