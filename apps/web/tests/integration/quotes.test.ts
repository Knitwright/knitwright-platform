import { describe, expect, it } from "vitest";
import { getBaseArticle } from "@/lib/catalogue";
import { priceFor } from "@/lib/factory/pricing";
import { supabaseFactoryStore } from "@/lib/factory/store";
import { capabilityFor } from "@/lib/factory/service";
import { candidateKits } from "@/lib/crest-to-kit/engine";
import { crestPixels } from "@/lib/crest-to-kit/fixtures/crests";
import { crestColours } from "@/lib/crest-to-kit/palette";
import { validatedKits } from "@/lib/crest-to-kit/validate";
import { buildQuote, priceDisagreement } from "@/lib/quotes/quote";
import { NO_DATE_YET } from "@/lib/quotes/fixtures/quote";
import { ruleForCountry, vatTreatment } from "@/lib/quotes/vat";
import { adminClient } from "./support";

/**
 * The quote and crest-to-kit against the rows that are really there (plan v5 Z6, decision 0102).
 *
 * Every test READS. Nothing is inserted, updated or deleted: the service role holds SELECT only on
 * these seeded tables, and a row a test added would stay in the shared database for good. What is
 * worth proving here is exactly the thing a unit test cannot: that the engine builds kits from the
 * catalogue rows as they stand, and that a quote priced from the seeded tiers equals `priceFor`.
 */

const store = () => supabaseFactoryStore(adminClient());

const seededLadder = async (articleCode: string) => {
  const factory = (await store().listFactories())[0]!;
  const snapshot = await store().snapshot(factory);
  const capability = capabilityFor(snapshot, articleCode);
  return snapshot.tiers.filter((tier) => tier.capabilityId === capability?.id);
};

describe("the market rules a quote reads", () => {
  it("gives the United Kingdom a rate and says the row is a placeholder", async () => {
    const rules = await store().listCountryRules();
    const treatment = vatTreatment(ruleForCountry(rules, "GB"));
    expect(treatment).toMatchObject({ country: "GB", countryName: "United Kingdom", rate: "20%" });
    expect(treatment.label).toMatch(/placeholder/i);
    expect(treatment.text).toContain("no tax is added to or taken off any figure");
  });

  it("says plainly that a closed market has no treatment, rather than showing a rate", async () => {
    const rules = await store().listCountryRules();
    const treatment = vatTreatment(ruleForCountry(rules, "US"));
    expect(treatment.rate).toBe("Not known yet");
    expect(treatment.text).toContain("does not sell into United States yet");
  });

  it("has no row for a market nobody has written one for", async () => {
    expect(ruleForCountry(await store().listCountryRules(), "NZ")).toBeNull();
  });
});

describe("a quote priced from the seeded tiers", () => {
  it("equals priceFor for every line, with the tier read at the whole basket", async () => {
    const shirt = await seededLadder("JSY-SS-01");
    const shorts = await seededLadder("SHO-TR-01");
    const rules = await store().listCountryRules();
    const input = {
      issuedAt: new Date("2026-11-02T09:00:00.000Z"),
      clubName: "Readback Rovers",
      brandName: "Readback Rovers",
      sportId: "football",
      sportLabel: "Football",
      currency: "GBP" as const,
      lines: [
        { articleCode: "JSY-SS-01", label: "Shirt", qty: 20, ladder: shirt },
        { articleCode: "SHO-TR-01", label: "Shorts", qty: 20, ladder: shorts },
      ],
      unpriced: [{ label: "Socks", reason: "No base article covers this part yet." }],
      inclusions: { crest: true, sponsors: 0, namesNumbers: false },
      delivery: NO_DATE_YET,
      vat: vatTreatment(ruleForCountry(rules, "GB")),
      linkBack: "/teamwear?sport=football&part=shirt&market=GBP",
      factoryLabel: null,
    };
    const quote = buildQuote(input);
    expect(quote.tierQty).toBe(40);
    expect(priceDisagreement(quote, input)).toBeNull();
    for (const [at, line] of quote.lines.entries()) {
      const again = priceFor(input.lines[at]!.ladder, input.lines[at]!.qty, "GBP", 40);
      expect(line.priced, line.articleCode).toBe(again.status === "priced");
      if (again.status === "priced") expect(line.lineMinor, line.articleCode).toBe(again.lineMinor);
    }
    // The socks are named on the quote, never priced around.
    expect(quote.totalNote).toContain("Socks");
  });

  it("can show no delivery date, because no market has freight days on file", async () => {
    // This is why nothing in this workstream prints a date: not one market row carries freight
    // days, and `promisedDate` (decision 0071) answers "not set" while any part of the sum is
    // missing. `lib/make/delivery.ts` is the one place the words for that are written, and the
    // quote prints exactly those.
    for (const rule of await store().listCountryRules()) expect(rule.freightDays, rule.country).toBeNull();
    expect(NO_DATE_YET.text).toContain("No delivery date yet");
    expect(NO_DATE_YET.text).toContain("the freight days");
  });
});

describe("crest-to-kit against the catalogue rows as they stand", () => {
  it("builds six to nine kits from JSY-SS-01's own print fills and finishes, and offers every one", async () => {
    const jersey = await getBaseArticle(adminClient(), "JSY-SS-01");
    const shorts = await getBaseArticle(adminClient(), "SHO-TR-01");
    expect(jersey).not.toBeNull();
    const articles = new Map([jersey, shorts].flatMap((one) => (one === null ? [] : [[one.code, one] as const])));
    const built = candidateKits({ sportId: "football", feel: "modern", roles: "all", palette: crestColours(crestPixels(12)), articles, crest: null });
    expect(built.status).toBe("kits");
    if (built.status !== "kits") return;
    expect(built.candidates.length).toBeGreaterThanOrEqual(6);
    expect(built.candidates.length).toBeLessThanOrEqual(9);

    // Every code the engine wrote is one the row itself lists.
    const offered = new Map<string, Set<string>>();
    for (const option of jersey!.options) offered.set(option.group, (offered.get(option.group) ?? new Set()).add(option.code));
    for (const candidate of built.candidates) {
      for (const [group, code] of Object.entries(candidate.kit.parts.shirt!.form.options)) {
        expect(offered.get(group)?.has(code), `${candidate.id} ${group}=${code}`).toBe(true);
      }
    }

    // And the checks let every one of them through, which is the acceptance test of F-T2.
    const checked = validatedKits(built.candidates, articles);
    expect(checked.setAside).toEqual([]);
    expect(checked.offered).toHaveLength(built.candidates.length);
  });
});
