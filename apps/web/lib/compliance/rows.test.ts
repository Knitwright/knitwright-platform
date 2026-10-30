import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SEEDED_AQL_PLAN, SEEDED_CARE_SYMBOLS, SEEDED_LABEL_RULES_GB, SEEDED_LABEL_RULES_US } from "./fixtures/rows";
import { labelRulesOf, toAqlPlan, toCareSymbol, AQL_PLAN_COLUMNS, CARE_SYMBOL_COLUMNS } from "./rows";

const sql = readFileSync(resolve(__dirname, "../../../../supabase/migrations/20261120070000_compliance.sql"), "utf8");

describe("the compliance migration", () => {
  it("seeds the five ISO 3758 categories and no symbol or instruction among them", () => {
    for (const symbol of SEEDED_CARE_SYMBOLS) expect(sql).toContain(`'${symbol.code}', '${symbol.kind}'`);
    // Nothing writes symbol_ref or words: the insert names neither column.
    expect(sql).toContain("insert into public.care_symbols (code, kind, source, source_kind, rule_id, label)");
    expect(sql).not.toMatch(/insert into public\.care_symbols[^;]*symbol_ref/);
  });

  it("seeds one AQL plan, the Class A sample, and names no inspection level", () => {
    expect(sql).toContain("insert into public.aql_plans (factory_id, scope, inspect_every_piece, source, rule_id, label)");
    expect(sql.match(/'class_a_sample'/g)?.length).toBeGreaterThan(0);
    // Decision 0070 section 6: the spec's level II / 2.5 / 4.0 is never assumed on a factory's behalf.
    expect(sql).not.toMatch(/insert into public\.aql_plans[^;]*'II'/);
  });

  it("writes the fibre line's language and order with the rulebook entry that asks for them", () => {
    expect(sql).toContain("'order', 'descending_percentage'");
    expect(sql).toContain("Rulebook R-LAB-002 (draft)");
  });

  it("writes the origin sentence with the file it comes from, and leaves care, size and importer empty", () => {
    expect(sql).toContain("'Made in Pakistan'");
    expect(sql).toContain("docs/spec/04-production-package.md, section 07_labels");
    expect(sql).toContain("'size', jsonb_build_object('text', null, 'confirmed', false, 'source', null)");
  });

  it("grants members a read and nobody a write", () => {
    expect(sql).toContain("grant select on public.care_symbols, public.aql_plans to authenticated");
    expect(sql).toContain("grant select, insert, update on public.care_symbols, public.aql_plans to service_role");
    expect(sql).toContain("There are no insert, update or delete policies on purpose.");
  });

  it("asks for every column the readers select", () => {
    for (const column of [...CARE_SYMBOL_COLUMNS.split(", "), ...AQL_PLAN_COLUMNS.split(", ")]) {
      expect(sql.includes(` ${column} `) || sql.includes(`\n  ${column} `) || column === "id").toBe(true);
    }
  });
});

describe("toCareSymbol", () => {
  it("reads a row and turns empty text into nothing written", () => {
    const symbol = toCareSymbol({
      id: "99999999-9999-4999-8999-000000000000",
      code: "ISO3758-WASHING",
      kind: "washing",
      symbol_ref: "   ",
      words: null,
      language: "en",
      source: "ISO 3758:2012, the washing category",
      source_kind: "standard",
      confirmed: false,
      rule_id: "R-LAB-002",
      label: "Knitwright draft",
    });
    expect(symbol.symbolRef).toBeNull();
    expect(symbol.words).toBeNull();
    expect(symbol.source).toBe("ISO 3758:2012, the washing category");
  });

  it("refuses a row whose rule id is not a rule id", () => {
    expect(() => toCareSymbol({ ...rowOf(), rule_id: "LAB-2" })).toThrow();
  });
});

const rowOf = (): Record<string, unknown> => ({
  id: "99999999-9999-4999-8999-000000000001",
  code: "ISO3758-DRYING",
  kind: "drying",
  symbol_ref: null,
  words: null,
  language: "en",
  source: null,
  source_kind: null,
  confirmed: false,
  rule_id: "R-LAB-002",
  label: "Knitwright draft",
});

describe("toAqlPlan", () => {
  it("reads numeric columns that come back as text, and keeps null as not agreed", () => {
    const plan = toAqlPlan({
      id: SEEDED_AQL_PLAN.id,
      factory_id: null,
      scope: "run",
      inspect_every_piece: false,
      inspection_level: "II",
      critical_aql: "0.0",
      major_aql: "2.5",
      minor_aql: null,
      source: "A factory's own plan",
      confirmed: true,
      rule_id: "R-QC-001",
      label: "Agreed with the factory",
    });
    expect(plan.criticalAql).toBe(0);
    expect(plan.majorAql).toBe(2.5);
    expect(plan.minorAql).toBeNull();
    expect(plan.factoryId).toBeNull();
  });
});

describe("labelRulesOf", () => {
  it("reads nothing out of an empty column, which is how X6 left it", () => {
    const rules = labelRulesOf({});
    expect(rules.fibre).toEqual({ text: null, source: null, confirmed: false, language: null, order: null });
    expect(rules.care.symbolCodes).toEqual([]);
    expect(rules.origin.text).toBeNull();
    expect(rules.importer.required).toBeNull();
    expect(rules.cpsiaRequired).toBeNull();
  });

  it("reads the seeded United Kingdom row: an origin and a fibre order, and nothing else", () => {
    const rules = labelRulesOf(SEEDED_LABEL_RULES_GB);
    expect(rules.fibre.language).toBe("en");
    expect(rules.fibre.order).toBe("descending_percentage");
    expect(rules.fibre.text).toBeNull();
    expect(rules.origin.text).toBe("Made in Pakistan");
    expect(rules.origin.source).toContain("04-production-package.md");
    expect(rules.care.symbolCodes).toEqual([]);
    expect(rules.size.text).toBeNull();
    expect(rules.importer.required).toBeNull();
    expect(rules.label).toContain("not reviewed by a factory");
  });

  it("reads the United States row's CPSIA requirement and where it comes from", () => {
    const rules = labelRulesOf(SEEDED_LABEL_RULES_US);
    expect(rules.cpsiaRequired).toBe(true);
    expect(rules.cpsiaSource).toBe("docs/spec/02-features.md, F-G3");
  });

  it("takes the flat origin key when there is no lines block, as lib/kpp already reads it", () => {
    expect(labelRulesOf({ origin: "Made in Pakistan" }).origin.text).toBe("Made in Pakistan");
  });

  it("reads nothing out of a column holding something it does not understand, rather than guessing", () => {
    expect(labelRulesOf({ lines: "a string" }).origin.text).toBeNull();
    expect(labelRulesOf({ lines: { fibre: 7 } }).fibre.text).toBeNull();
  });

  it("treats whitespace as nothing written", () => {
    expect(labelRulesOf({ lines: { origin: { text: "   ", source: "somewhere" } } }).origin.text).toBeNull();
  });
});
