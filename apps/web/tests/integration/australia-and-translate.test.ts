import { beforeAll, describe, expect, it } from "vitest";
import { labelRulesOf } from "@/lib/compliance/rows";
import { COUNTRY_COLUMNS, toCountryRule } from "@/lib/factory/rows";
import type { CountryRule } from "@/lib/factory/schemas";
import { taxTreatment } from "@/lib/markets/tax";
import { australiaSeedTemplates } from "@/lib/templates/seed/australia/build";
import { seedTemplates } from "@/lib/templates/seed/seed";
import { TRANSLATION_KEYS } from "@/lib/translate/keys";
import { TRANSLATION_COLUMNS, toTranslationRows } from "@/lib/translate/rows";
import { dictionaryFor } from "@/lib/translate/dictionary";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261210030000_australia_and_translate.sql against the real database (plan v5 O3, decision
 * 0104): Australia's tax treatment, the AUD half of the price ladder, why the care line is refused, and
 * the translation library with nobody's name against any of it.
 *
 * Every test reads. Nothing here inserts a row into a seeded table, because the database is shared.
 * `seedTemplates` is the one exception, and it is an upsert keyed by slug that the template tests
 * already run, so running it again changes the rows it made and adds nothing.
 */

let alice: Person;

const countryRules = async (): Promise<readonly CountryRule[]> =>
  (must(await adminClient().from("country_rules").select(COUNTRY_COLUMNS).order("country")) as Record<string, unknown>[]).map(toCountryRule);

const ruleFor = async (country: string): Promise<CountryRule> => {
  const found = (await countryRules()).find((rule) => rule.country === country);
  expect(found, country).toBeDefined();
  return found!;
};

beforeAll(async () => {
  alice = await person("au-alice");
  await brandOf(alice, "Alice Australia FC");
  await seedTemplates(adminClient());
});

describe("Australia's tax treatment", () => {
  it("charges GST at 10% once registered, and nobody is registered", async () => {
    const rule = await ruleFor("AU");

    expect(rule.taxName).toBe("GST");
    expect(rule.vatRateBp).toBe(1000);
    expect(rule.taxRegistered).toBe(false);
    expect(rule.taxRegistrationThresholdMinor).toBe(7_500_000);
    expect(rule.taxSource).toContain("AUD 75,000");
    expect(taxTreatment(rule).state).toBe("not-registered");
    expect(taxTreatment(rule).line).toContain("Prices carry no GST");
  });

  it("names VAT for the United Kingdom, with no registration threshold recorded", async () => {
    const rule = await ruleFor("GB");

    expect(rule.taxName).toBe("VAT");
    expect(rule.taxRegistered).toBe(false);
    expect(rule.taxRegistrationThresholdMinor).toBeNull();
  });

  it("says nothing about the two closed markets", async () => {
    for (const country of ["US", "EU"]) {
      const rule = await ruleFor(country);
      expect(rule.taxName, country).toBeNull();
      expect(rule.taxRegistered, country).toBe(false);
      expect(rule.sellingEnabled, country).toBe(false);
    }
  });

  it("refuses a registration threshold with no source", async () => {
    const { error } = await adminClient()
      .from("country_rules")
      .update({ tax_registration_threshold_minor: 1000, tax_source: null })
      .eq("country", "AU");

    expect(error?.message ?? "").toContain("country_rules_threshold_has_a_source");
  });

  it("lets a signed-in member read a market's tax treatment, and nobody else", async () => {
    const mine = must(await alice.client.from("country_rules").select("country, tax_name, tax_registered").eq("country", "AU"));
    expect(mine).toHaveLength(1);
    const { data } = await anonClient().from("country_rules").select("country").eq("country", "AU");
    expect(data ?? []).toEqual([]);
  });
});

describe("the AUD half of the price ladder", () => {
  it("keeps the quantity bands and no AUD price, and says why on every row", async () => {
    const rows = must(await adminClient().from("price_tiers").select("qty_min, qty_max, sell_gbp_minor, sell_aud_minor, label").order("qty_min")) as Record<
      string,
      unknown
    >[];
    const priced = rows.filter((row) => row.sell_gbp_minor !== null);

    expect(priced.length).toBeGreaterThan(0);
    for (const row of priced) {
      expect(row.sell_aud_minor, String(row.qty_min)).toBeNull();
      expect(String(row.label), String(row.qty_min)).toContain("No AUD price");
    }
  });
});

describe("why Australia's care line is refused", () => {
  it("says in the market's own row that ISO 3758 is a paid standard nobody here holds", async () => {
    const rules = labelRulesOf((await ruleFor("AU")).labelRules);

    expect(rules.care.symbolCodes).toEqual([]);
    expect(rules.care.gapRuleId).toBe("R-LAB-002");
    expect(rules.care.gapNote).toContain("ISO 3758 is a paid standard");
    expect(rules.care.gapNote).toContain("has been transcribed");
  });

  it("leaves the lines Z8 wrote exactly as they were, so Australia can still carry them", async () => {
    const rules = labelRulesOf((await ruleFor("AU")).labelRules);

    expect(rules.fibre.language).toBe("en");
    expect(rules.fibre.order).toBe("descending_percentage");
    expect(rules.origin.text).toBe("Made in Pakistan");
    expect(rules.size.convention).toBe("size_code");
    // Still nobody's word on an importer address, which is a question, not a guess.
    expect(rules.importer.required).toBeNull();
  });

  it("holds no care symbol, no care instruction and no words of the standard anywhere", async () => {
    const symbols = must(await adminClient().from("care_symbols").select("symbol_ref, words")) as Record<string, unknown>[];
    expect(symbols.length).toBeGreaterThan(0);
    for (const symbol of symbols) {
      expect(symbol.symbol_ref).toBeNull();
      expect(symbol.words).toBeNull();
    }
  });
});

describe("the translation library", () => {
  const urdu = async () =>
    toTranslationRows(
      must(await adminClient().from("translation_strings").select(TRANSLATION_COLUMNS).eq("language", "ur").order("key")) as Record<string, unknown>[],
    );

  it("holds one Urdu row for every key the platform can translate", async () => {
    const rows = await urdu();
    expect(rows).toHaveLength(TRANSLATION_KEYS.length);
    expect([...rows].map((row) => row.key).sort()).toEqual([...TRANSLATION_KEYS].sort());
  });

  it("has nobody's name against any of it, and no machine behind any of it", async () => {
    for (const row of await urdu()) {
      expect(row.reviewedBy, row.key).toBeNull();
      expect(row.reviewedOn, row.key).toBeNull();
      expect(row.machine, row.key).toBe(false);
      expect(row.label, row.key).toContain("No Urdu speaker has read");
    }
    const dictionary = dictionaryFor("ur", await urdu());
    expect(dictionary.reviewed).toBe(false);
    expect(dictionary.unreviewed).toHaveLength(TRANSLATION_KEYS.length);
    expect(dictionary.fromLibrary).toBe(true);
  });

  it("refuses a machine translation that claims a reviewer", async () => {
    const { error } = await adminClient()
      .from("translation_strings")
      .update({ machine: true, reviewed_by: "A Service", reviewed_role: "Robot", reviewed_on: "2026-11-02" })
      .eq("key", "page.overview")
      .eq("language", "ur");

    expect(error?.message ?? "").toContain("machine_translation_is_never_reviewed");
  });

  it("refuses a review that does not name the person, the role and the day", async () => {
    const { error } = await adminClient().from("translation_strings").update({ reviewed_by: "A Khan" }).eq("key", "page.qc").eq("language", "ur");

    expect(error?.message ?? "").toContain("translation_review_names_a_person");
  });

  it("is read by a signed-in member and by nobody else", async () => {
    const mine = must(await alice.client.from("translation_strings").select("key").eq("language", "ur"));
    expect(mine.length).toBe(TRANSLATION_KEYS.length);
    const { data } = await anonClient().from("translation_strings").select("key");
    expect(data ?? []).toEqual([]);
  });

  it("is written by nobody from a browser", async () => {
    const { error } = await alice.client.from("translation_strings").update({ text: "x" }).eq("key", "page.qc").eq("language", "ur");
    expect(error).not.toBeNull();
  });
});

describe("the Australian starters in the library", () => {
  it("stores every one as a design, beside the sixty of 07", async () => {
    const slugs = australiaSeedTemplates().map((seed) => seed.slug);
    const rows = must(await alice.client.from("templates").select("slug, kind, sport, article_id, wearer, sport_tags").in("slug", slugs)) as Record<
      string,
      unknown
    >[];

    expect(rows).toHaveLength(slugs.length);
    expect(rows.every((row) => row.kind === "design")).toBe(true);
    expect(rows.every((row) => row.article_id !== null && row.wearer !== null)).toBe(true);
    expect(rows.filter((row) => (row.sport_tags as string[]).includes("cricket"))).toHaveLength(2);
    expect(rows.filter((row) => (row.sport_tags as string[]).length === 0)).toHaveLength(6);
  });
});
