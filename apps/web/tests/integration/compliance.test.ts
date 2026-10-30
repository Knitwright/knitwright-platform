import { beforeAll, describe, expect, it } from "vitest";
import { destinationLabel, printableLines } from "@/lib/compliance/labels";
import { AQL_PLAN_COLUMNS, CARE_SYMBOL_COLUMNS, toAqlPlan, toCareSymbol, type AqlPlan, type CareSymbol } from "@/lib/compliance/rows";
import { COUNTRY_COLUMNS, toCountryRule } from "@/lib/factory/rows";
import type { CountryRule } from "@/lib/factory/schemas";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261120070000_compliance.sql against the real database (plan v5 Z8, decision 0089): what the
 * seed does and does not say, what the table checks refuse, and — the one that matters — that a label built
 * from the rows the platform really holds carries nothing a factory could read as agreed.
 */

let alice: Person;

const careSymbols = async (): Promise<readonly CareSymbol[]> =>
  (must(await adminClient().from("care_symbols").select(CARE_SYMBOL_COLUMNS).order("code")) as Record<string, unknown>[]).map(toCareSymbol);

const aqlPlans = async (): Promise<readonly AqlPlan[]> =>
  (must(await adminClient().from("aql_plans").select(AQL_PLAN_COLUMNS).order("scope")) as Record<string, unknown>[]).map(toAqlPlan);

const countryRules = async (): Promise<readonly CountryRule[]> =>
  (must(await adminClient().from("country_rules").select(COUNTRY_COLUMNS).order("country")) as Record<string, unknown>[]).map(toCountryRule);

beforeAll(async () => {
  alice = await person("compliance-alice");
  await brandOf(alice, "Alice Compliance FC");
});

describe("the seeded care symbols", () => {
  it("are the five ISO 3758 categories, each citing the standard", async () => {
    const symbols = await careSymbols();
    expect(symbols.map((symbol) => symbol.kind).sort()).toEqual(["bleaching", "drying", "ironing", "professional", "washing"]);
    for (const symbol of symbols) {
      expect(symbol.source, symbol.code).toContain("ISO 3758:2012");
      expect(symbol.sourceKind, symbol.code).toBe("standard");
      expect(symbol.ruleId, symbol.code).toBe("R-LAB-002");
    }
  });

  it("transcribe no symbol and no care instruction, and say so in their labels", async () => {
    for (const symbol of await careSymbols()) {
      expect(symbol.symbolRef, symbol.code).toBeNull();
      expect(symbol.words, symbol.code).toBeNull();
      expect(symbol.confirmed, symbol.code).toBe(false);
      expect(symbol.label, symbol.code).toContain("not in this repository");
    }
  });
});

describe("what the care symbol table refuses", () => {
  it("refuses words with no source behind them", async () => {
    const { error } = await adminClient()
      .from("care_symbols")
      .insert({ code: "TEST-NO-SOURCE", kind: "washing", words: "Wash at 30", label: "Test row" });
    expect(error).not.toBeNull();
  });

  it("refuses a confirmed row that is not a whole row", async () => {
    const { error } = await adminClient()
      .from("care_symbols")
      .insert({ code: "TEST-HALF", kind: "ironing", source: "Somewhere", confirmed: true, label: "Test row" });
    expect(error).not.toBeNull();
  });

  it("refuses a rule id that is not a rule id, and a kind outside ISO 3758", async () => {
    expect((await adminClient().from("care_symbols").insert({ code: "TEST-RULE", kind: "washing", rule_id: "LAB-2", label: "Test row" })).error).not.toBeNull();
    expect((await adminClient().from("care_symbols").insert({ code: "TEST-KIND", kind: "soaking", label: "Test row" })).error).not.toBeNull();
  });
});

describe("the seeded AQL plan", () => {
  it("is owner decision 19's Class A sample and nothing else", async () => {
    const plans = await aqlPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ scope: "class_a_sample", factoryId: null, inspectEveryPiece: true, confirmed: false, ruleId: "R-QC-001" });
    expect(plans[0]?.source).toContain("Owner decision 19");
  });

  it("names no inspection level and no acceptance limit, because no factory has agreed one", async () => {
    const [plan] = await aqlPlans();
    expect(plan?.inspectionLevel).toBeNull();
    expect(plan?.criticalAql).toBeNull();
    expect(plan?.majorAql).toBeNull();
    expect(plan?.minorAql).toBeNull();
    expect(plan?.label).toContain("No run plan is seeded");
  });
});

describe("what the AQL plan table refuses", () => {
  it("refuses a level with no source behind it", async () => {
    const { error } = await adminClient().from("aql_plans").insert({ scope: "run", inspection_level: "II", label: "Test row" });
    expect(error).not.toBeNull();
  });

  it("refuses a plan that neither inspects every piece nor names a level", async () => {
    const { error } = await adminClient().from("aql_plans").insert({ scope: "run", label: "Test row" });
    expect(error).not.toBeNull();
  });

  it("refuses a second plan for every factory at the same scope", async () => {
    const { error } = await adminClient()
      .from("aql_plans")
      .insert({ scope: "class_a_sample", inspect_every_piece: true, label: "Test row" });
    expect(error).not.toBeNull();
  });
});

describe("the seeded label wording", () => {
  it("writes an origin sentence and a fibre order for the two open markets, and nothing for the closed ones", async () => {
    const rules = await countryRules();
    const byCountry = new Map(rules.map((rule) => [rule.country, rule]));
    for (const country of ["GB", "AU"]) {
      const lines = byCountry.get(country)?.labelRules as { lines?: Record<string, Record<string, unknown>> };
      expect(lines.lines?.origin?.text, country).toBe("Made in Pakistan");
      expect(lines.lines?.fibre?.order, country).toBe("descending_percentage");
      expect(lines.lines?.care?.symbolCodes, country).toEqual([]);
      expect(lines.lines?.size?.text, country).toBeNull();
      expect(lines.lines?.importer?.required, country).toBeNull();
    }
    expect((byCountry.get("US")?.labelRules as { cpsiaRequired?: unknown }).cpsiaRequired).toBe(true);
    expect((byCountry.get("EU")?.labelRules as { lines?: Record<string, Record<string, unknown>> }).lines?.fibre?.language).toBeNull();
  });

  it("keeps the markets a member may read at the four X6 seeded", async () => {
    expect(must(await alice.client.from("country_rules").select("country")).length).toBe(4);
  });
});

/**
 * The test the orchestrator asked for by name, against the real rows: nothing unsourced reaches a label a
 * factory would read. It is the whole point of the migration being a seed of labelled defaults rather than a
 * seed of plausible sentences.
 */
describe("a label built from the rows the platform really holds", () => {
  it("may not be used in any market, and prints nothing", async () => {
    const symbols = await careSymbols();
    for (const rule of await countryRules()) {
      const label = destinationLabel({
        country: rule.country,
        countryName: rule.name,
        sellingEnabled: rule.sellingEnabled,
        labelRules: rule.labelRules,
        ruleId: rule.ruleId,
        fabric: { code: "F-POLY-INT", name: "Polyester interlock", blend: "100% polyester", pfasFree: true, oekoTexCert: null },
        wearer: "men",
        sizes: ["S", "M", "L"],
        importer: null,
        cpsiaCertificate: null,
        careSymbols: symbols,
      });
      expect(label.usable, rule.country).toBe(false);
      expect(printableLines(label), rule.country).toEqual([]);
      expect(label.findings.length, rule.country).toBeGreaterThan(0);
      for (const found of label.findings) expect(found.ruleId, `${rule.country} ${found.code}`).toMatch(/^R-[A-Z]+-[0-9]{3}$/);
    }
  });

  it("gives every line it does hold a source, and nothing without one", async () => {
    const symbols = await careSymbols();
    const rule = (await countryRules()).find((one) => one.country === "GB")!;
    const label = destinationLabel({
      country: rule.country,
      countryName: rule.name,
      sellingEnabled: rule.sellingEnabled,
      labelRules: rule.labelRules,
      ruleId: rule.ruleId,
      fabric: { code: "F-POLY-INT", name: "Polyester interlock", blend: "100% polyester", pfasFree: true, oekoTexCert: null },
      wearer: "men",
      sizes: ["M"],
      importer: null,
      cpsiaCertificate: null,
      careSymbols: symbols,
    });
    expect(label.lines.map((line) => line.kind)).toEqual(["fibre", "origin"]);
    for (const line of label.lines) {
      expect(line.source.trim(), line.kind).not.toBe("");
      expect(line.text.trim(), line.kind).not.toBe("");
      expect(line.confirmed, line.kind).toBe(false);
    }
  });

  it("refuses a youth garment wherever it is sold, because no CPSIA test certificate exists", async () => {
    const rule = (await countryRules()).find((one) => one.country === "GB")!;
    const label = destinationLabel({
      country: rule.country,
      countryName: rule.name,
      sellingEnabled: rule.sellingEnabled,
      labelRules: rule.labelRules,
      ruleId: rule.ruleId,
      fabric: { code: "F-POLY-INT", name: "Polyester interlock", blend: "100% polyester", pfasFree: true, oekoTexCert: null },
      wearer: "youth",
      sizes: ["YS"],
      importer: null,
      cpsiaCertificate: null,
      careSymbols: [],
    });
    expect(label.findings.map((found) => found.code)).toContain("cpsia_childrens_sizes");
  });

  it("refuses every seeded fabric, because no mill has declared any of them PFAS-free", async () => {
    const fabrics = must(await adminClient().from("programme_fabrics").select("code, name, blend, pfas_free, oeko_tex_cert")) as Record<string, unknown>[];
    const rule = (await countryRules()).find((one) => one.country === "GB")!;
    for (const row of fabrics) {
      const label = destinationLabel({
        country: rule.country,
        countryName: rule.name,
        sellingEnabled: rule.sellingEnabled,
        labelRules: rule.labelRules,
        ruleId: rule.ruleId,
        fabric: { code: String(row.code), name: String(row.name), blend: (row.blend as string | null) ?? null, pfasFree: (row.pfas_free as boolean | null) ?? null, oekoTexCert: (row.oeko_tex_cert as string | null) ?? null },
        wearer: "men",
        sizes: ["M"],
        importer: null,
        cpsiaCertificate: null,
        careSymbols: [],
      });
      expect(label.findings.map((found) => found.code), String(row.code)).toContain("pfas_not_declared");
    }
  });

  it("claims an OEKO-TEX certificate for no fabric, because no row holds one", async () => {
    const fabrics = must(await adminClient().from("programme_fabrics").select("code, oeko_tex_cert")) as Record<string, unknown>[];
    expect(fabrics.filter((row) => row.oeko_tex_cert !== null)).toEqual([]);
  });
});
