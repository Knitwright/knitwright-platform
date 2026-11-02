import { describe, expect, it } from "vitest";
import { appTier } from "@/lib/factory/fixtures/rows";
import { MARKETS } from "@/lib/home/market";
import { labelRulesOf } from "@/lib/compliance/rows";
import { appRule, auLabelRules } from "./fixtures/rules";
import { labelLinesFor, marketSummary, type MarketSummaryInput } from "./view";

/**
 * What choosing Australia shows beside the selector: the currency, the tax, the label lines and what is
 * still missing. Nothing is converted, assumed or worked out (decision 0102).
 */

const AU = MARKETS.find((market) => market.id === "au")!;
const UK = MARKETS.find((market) => market.id === "uk")!;

/** The ladder X6 seeds: three bands, a GBP price in each, no AUD price in any. */
const seededLadder = [appTier(10, 19, 2900), appTier(20, 49, 2500), appTier(50, null, 2200)];

const input = (over: Partial<MarketSummaryInput> = {}): MarketSummaryInput => ({
  market: AU,
  rule: appRule({ labelRules: auLabelRules() }),
  price: { ladder: seededLadder, moq: 1 },
  leadTimeDays: 8,
  qcDays: null,
  ...over,
});

describe("the price ladder of the market that is chosen", () => {
  it("shows the AUD bands with no price in any of them, and never a converted figure", () => {
    const summary = marketSummary(input());
    expect(summary.currency).toBe("AUD");
    expect(summary.ladder.map((row) => row.quantity)).toEqual(["10-19", "20-49", "50+"]);
    for (const row of summary.ladder) {
      expect(row.priced, row.quantity).toBe(false);
      expect(row.unit, row.quantity).toBe("No AUD price is set yet");
      // The GBP figure is nowhere in the AUD ladder: no 29, 25 or 22 in any shape.
      expect(row.unit).not.toMatch(/\d/u);
    }
    expect(summary.priceNote).toBe(
      "No AUD price is set in any tier. The ladder's quantity bands are on file; the prices for Australia are not.",
    );
  });

  it("shows the same ladder priced for the United Kingdom, from the same rows", () => {
    const summary = marketSummary(input({ market: UK, rule: appRule({ country: "GB", name: "United Kingdom", currency: "GBP", taxName: "VAT" }) }));
    expect(summary.ladder.map((row) => row.unit)).toEqual(["£29.00", "£25.00", "£22.00"]);
    expect(summary.priceNote).toBe("Every tier has a GBP price.");
  });

  it("says so when the article has no ladder at all", () => {
    const summary = marketSummary(input({ price: { ladder: [], moq: null } }));
    expect(summary.ladder).toEqual([]);
    expect(summary.priceNote).toContain("No price ladder is on file for this article");
  });

  it("counts the tiers that do have a price when only some do", () => {
    const summary = marketSummary(input({ price: { ladder: [appTier(10, 19, 2900, 5600), appTier(20, null, 2500)], moq: 1 } }));
    expect(summary.priceNote).toBe("1 of 2 tiers have a AUD price; the others say so.");
  });
});

describe("what the market's label rules allow", () => {
  const lines = labelLinesFor(labelRulesOf(auLabelRules()));
  const by = (kind: string) => lines.find((line) => line.kind === kind)!;

  it("has the fibre, origin and size lines ready, from the rows that state them", () => {
    expect(by("fibre").ready).toBe(true);
    expect(by("fibre").note).toBe("In en, descending percentage, from the fabric's own blend.");
    expect(by("origin").note).toBe("Made in Pakistan");
    expect(by("origin").ready).toBe(true);
    expect(by("size").ready).toBe(true);
    expect(by("size").note).toContain("One label per size");
  });

  it("refuses the care line in the market's own words, with the rule that explains it", () => {
    const care = by("care");
    expect(care.ready).toBe(false);
    expect(care.note).toContain("ISO 3758 is a paid standard");
    expect(care.ruleId).toBe("R-LAB-002");
    // No symbol, no instruction and no words of a standard are anywhere in the line.
    expect(care.note).not.toMatch(/wash|40|iron|bleach/iu);
  });

  it("names the importer requirement as unrecorded, and carries R-GAP-000 for it", () => {
    expect(by("importer").ready).toBe(false);
    expect(by("importer").note).toContain("Nobody has recorded whether this market needs an importer address");
    expect(by("importer").ruleId).toBe("R-GAP-000");
  });

  it("reads a market with nothing written as a market with nothing written", () => {
    const empty = labelLinesFor(labelRulesOf({}));
    expect(empty.every((line) => !line.ready)).toBe(true);
    expect(empty.find((line) => line.kind === "fibre")!.note).toContain("which language and which order");
    expect(empty.find((line) => line.kind === "care")!.note).toContain("none is transcribed in the platform");
    expect(empty.find((line) => line.kind === "size")!.note).toContain("Nobody has written how a size is designated");
  });

  it("says a care line is ready only once symbols are chosen and something says why", () => {
    const chosen = labelLinesFor(
      labelRulesOf({ lines: { care: { symbolCodes: ["ISO3758-WASHING"], source: "A licensed copy of ISO 3758", confirmed: true } } }),
    );
    expect(chosen.find((line) => line.kind === "care")).toMatchObject({ ready: true, note: "1 symbol chosen for this market." });
  });

  it("counts more than one chosen symbol, and refuses them while nothing says why they are the ones", () => {
    const codes = ["ISO3758-WASHING", "ISO3758-DRYING"];
    const unsourced = labelLinesFor(labelRulesOf({ lines: { care: { symbolCodes: codes, source: null } } }));
    expect(unsourced.find((line) => line.kind === "care")).toMatchObject({ ready: false, note: "2 symbols chosen for this market." });
    const sourced = labelLinesFor(labelRulesOf({ lines: { care: { symbolCodes: codes, source: "A licensed copy of ISO 3758" } } }));
    expect(sourced.find((line) => line.kind === "care")!.ready).toBe(true);
  });

  it("prints a market's own size sentence where it has written one, instead of the convention", () => {
    const written = labelLinesFor(
      labelRulesOf({ lines: { size: { text: "Size in centimetres", source: "A legal adviser, 2027", confirmed: true } } }),
    );
    expect(written.find((line) => line.kind === "size")).toMatchObject({ ready: true, note: "Size in centimetres" });
  });

  it("names the importer address as needed or not needed once the market's row records it", () => {
    const needed = labelLinesFor(labelRulesOf({ lines: { importer: { required: true, source: "A customs adviser, 2027" } } }));
    expect(needed.find((line) => line.kind === "importer")).toMatchObject({ ready: true, ruleId: "R-LAB-002" });
    expect(needed.find((line) => line.kind === "importer")!.note).toContain("needs an importer address");

    const notNeeded = labelLinesFor(labelRulesOf({ lines: { importer: { required: false, source: "A customs adviser, 2027" } } }));
    expect(notNeeded.find((line) => line.kind === "importer")).toMatchObject({ ready: true, note: "This market needs no importer address." });
  });
});

describe("what is still missing for the market", () => {
  it("shows no delivery date, and names the parts nobody has agreed", () => {
    const summary = marketSummary(input());
    expect(summary.deliveryNote).toBe("No delivery date yet. Not set: the days for QC and the freight days.");
    expect(summary.gaps.map((gap) => gap.note)).toContain("No delivery date can be shown. Not set: the days for QC and the freight days.");
  });

  it("gathers the tax, the price, every refused label line and the date into one list, each with a rule", () => {
    const summary = marketSummary(input());
    expect(summary.gaps.length).toBeGreaterThanOrEqual(5);
    for (const gap of summary.gaps) expect(gap.ruleId, gap.note).toMatch(/^R-[A-Z]+-\d{3}$/u);
    expect(summary.gaps.some((gap) => gap.note.includes("Registered above A$75,000.00"))).toBe(true);
    expect(summary.gaps.some((gap) => gap.note.startsWith("Care symbols:"))).toBe(true);
  });

  it("offers a date only when the lead time, the QC days and the freight days are all agreed", () => {
    const summary = marketSummary(input({ qcDays: 2, rule: appRule({ freightDays: 6, labelRules: auLabelRules() }) }));
    expect(summary.deliveryNote).toBe("A delivery date can be worked out for this market.");
    expect(summary.gaps.some((gap) => gap.note.includes("delivery date"))).toBe(false);
  });

  it("carries the market row's own label, so no figure reads as agreed", () => {
    expect(marketSummary(input()).rowLabel).toBe("Placeholder, to confirm with a customs adviser");
    expect(marketSummary(input()).sellingEnabled).toBe(true);
  });

  it("says so, and shows nothing as settled, when the market's rules could not be read", () => {
    const summary = marketSummary(input({ rule: null }));
    expect(summary.sellingEnabled).toBe(false);
    expect(summary.tax.state).toBe("not-recorded");
    expect(summary.gaps[0]!.note).toContain("could not be read");
    expect(summary.rowLabel).toBeNull();
  });

  it("is the same summary every time it is read from the same rows", () => {
    expect(JSON.stringify(marketSummary(input()))).toBe(JSON.stringify(marketSummary(input())));
  });
});
