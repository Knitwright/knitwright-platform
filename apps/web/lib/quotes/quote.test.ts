import { describe, expect, it } from "vitest";
import { formatMoney, priceBasket, priceFor } from "@/lib/factory/pricing";
import { ISSUED_AT, JERSEY_LADDER, NO_DATE_YET, quoteInput, SHORTS_LADDER, testQuote } from "./fixtures/quote";
import { buildQuote, NO_TOTAL, priceDisagreement, QuoteRefused } from "./quote";
import { QUOTE_SETTINGS } from "./settings";

describe("the quote's own numbers", () => {
  it("are exactly what priceFor gives for the tier read at the whole basket", () => {
    const quote = testQuote();
    expect(quote.tierQty).toBe(40);
    const expected = priceFor(JERSEY_LADDER, 20, "GBP", 40);
    expect(expected.status).toBe("priced");
    if (expected.status !== "priced") return;
    expect(quote.lines[0]).toMatchObject({ unitMinor: expected.unitMinor, lineMinor: expected.lineMinor, unit: formatMoney(expected.unitMinor, "GBP") });
    expect(quote.lines[0]!.tier).toBe("20-49");
  });

  it("reads the tier across the whole basket, not line by line", () => {
    // Twenty shirts alone fall in the 20-49 tier; twenty shirts and twenty shorts still read at 40.
    const alone = buildQuote(quoteInput({ lines: [{ articleCode: "JSY-SS-01", label: "Shirt", qty: 20, ladder: JERSEY_LADDER }] }));
    expect(alone.tierQty).toBe(20);
    expect(testQuote().tierQty).toBe(40);
    expect(testQuote().lines[0]!.unitMinor).toBe(alone.lines[0]!.unitMinor);
  });

  it("totals the lines in minor units, never out of the words", () => {
    const quote = testQuote();
    expect(quote.totalMinor).toBe(quote.lines.reduce((sum, line) => sum + (line.lineMinor ?? 0), 0));
    expect(quote.total).toBe(formatMoney(quote.totalMinor!, "GBP"));
  });

  it("agrees with priceFor, line for line, and says so when it would not", () => {
    const input = quoteInput();
    expect(priceDisagreement(testQuote(), input)).toBeNull();
    const wrong = { ...testQuote(), lines: [{ ...testQuote().lines[0]!, unitMinor: 1 }, testQuote().lines[1]!] };
    expect(priceDisagreement(wrong, input)).toContain("from priceFor");
  });

  it("notices a quote priced at another tier than the basket it came from", () => {
    // Fifty pieces fall in a cheaper tier, so a quote claiming that tier at forty disagrees.
    expect(priceDisagreement({ ...testQuote(), tierQty: 50 }, quoteInput())).toContain("from priceFor");
  });

  it("notices a line shown as priced that priceFor cannot price, and the other way about", () => {
    const noLadder = quoteInput({ lines: [{ articleCode: "SHO-TR-01", label: "Shorts", qty: 20, ladder: [] }], unpriced: [] });
    expect(priceDisagreement(testQuote(), noLadder)).toContain("priceFor gives no price");
    const unpricedQuote = buildQuote(noLadder);
    expect(priceDisagreement(unpricedQuote, quoteInput({ lines: [quoteInput().lines[0]!], unpriced: [] }))).toContain("priceFor gives one");
  });

  it("notices a line with no basket line behind it", () => {
    const quote = testQuote();
    expect(priceDisagreement(quote, quoteInput({ lines: [quoteInput().lines[0]!] }))).toContain("no basket line");
  });
});

describe("a basket the factory cannot price", () => {
  it("names the line, leaves it out of the total, and never shows it as free", () => {
    const quote = buildQuote(
      quoteInput({
        currency: "AUD",
        lines: [{ articleCode: "JSY-SS-01", label: "Shirt", qty: 20, ladder: JERSEY_LADDER }],
        unpriced: [],
      }),
    );
    expect(quote.lines[0]).toMatchObject({ priced: false, unit: NO_TOTAL, line: NO_TOTAL, lineMinor: null });
    expect(quote.lines[0]!.reason).toContain("No AUD price");
    expect(quote.total).toBe(NO_TOTAL);
    expect(quote.totalNote).toContain("leaves out Shirt");
  });

  it("says which parts the total leaves out, including the ones with no base article", () => {
    const quote = testQuote();
    expect(quote.totalNote).toContain("Socks");
    expect(quote.unpriced[0]!.reason).toContain("no price for it");
  });

  it("leaves no note when every part is priced", () => {
    expect(buildQuote(quoteInput({ unpriced: [] })).totalNote).toBeNull();
  });

  it("refuses a basket with nothing in it, rather than quoting nothing", () => {
    expect(() => buildQuote(quoteInput({ lines: [] }))).toThrow(QuoteRefused);
    expect(() => buildQuote(quoteInput({ lines: [] }))).toThrow(/nothing to quote/);
  });

  it("refuses a quantity below every tier, saying where the tiers start", () => {
    const quote = buildQuote(quoteInput({ lines: [{ articleCode: "JSY-SS-01", label: "Shirt", qty: 2, ladder: JERSEY_LADDER }], unpriced: [] }));
    expect(quote.lines[0]!.reason).toContain("smallest tier starts at 10");
  });

  it("says a line has no price where the article has no ladder at all", () => {
    const quote = buildQuote(quoteInput({ lines: [{ articleCode: "SHO-TR-01", label: "Shorts", qty: 20, ladder: [] }], unpriced: [] }));
    expect(quote.lines[0]!.reason).toContain("No price ladder");
  });
});

describe("what else a quote carries", () => {
  it("has a number, the day it was made, and thirty days of validity", () => {
    const quote = testQuote();
    expect(quote.number).toMatch(/^KWQ-20261102-[A-Z2-9]{6}$/);
    expect(quote.issuedOn).toBe("2026-11-02");
    expect(quote.validUntil).toBe("2026-12-02");
    expect(quote.validityDays).toBe(QUOTE_SETTINGS.validityDays);
  });

  it("gives the same number for the same basket on the same day, whatever order the lines came in", () => {
    const input = quoteInput();
    const reversed = quoteInput({ lines: [input.lines[1]!, input.lines[0]!] });
    expect(buildQuote(reversed).number).toBe(buildQuote(input).number);
  });

  it("gives a different number for a different basket", () => {
    expect(buildQuote(quoteInput({ lines: [{ articleCode: "JSY-SS-01", label: "Shirt", qty: 21, ladder: JERSEY_LADDER }] })).number).not.toBe(testQuote().number);
  });

  it("says what is included, with the rule behind each line", () => {
    const quote = testQuote();
    expect(quote.inclusions.map((one) => one.id)).toEqual(["crest", "sponsors", "names-numbers"]);
    for (const one of quote.inclusions) expect(one.ruleId).toMatch(/^R-[A-Z]+-[0-9]{3}$/);
  });

  it("carries the delivery line and the VAT treatment it was given, unchanged", () => {
    const quote = testQuote();
    expect(quote.delivery).toBe(NO_DATE_YET);
    expect(quote.vat.rate).toBe("20%");
    expect(quote.ruleIds).toContain("R-GAP-000");
  });

  it("carries a link back and the factory's own label", () => {
    const quote = testQuote();
    expect(quote.linkBack).toContain("/teamwear?");
    expect(quote.factoryLabel).toContain("Sialkot");
    expect(buildQuote(quoteInput({ factoryLabel: null })).factoryLabel).toBeNull();
  });

  it("prices the basket through X6's own function, so the two can never drift", () => {
    const basket = priceBasket(
      [
        { articleCode: "JSY-SS-01", qty: 20, ladder: JERSEY_LADDER },
        { articleCode: "SHO-TR-01", qty: 20, ladder: SHORTS_LADDER },
      ],
      "GBP",
    );
    expect(testQuote().totalMinor).toBe(basket.totalMinor);
    expect(ISSUED_AT.toISOString()).toContain("2026-11-02");
  });
});
