import { describe, expect, it } from "vitest";
import { allText, readPages } from "@/lib/techpack/exports/fixtures/pdf-pages";
import { buildQuotePdf } from "./document";
import { NO_DATE_YET, quoteInput, testQuote, WITH_DATE } from "./fixtures/quote";
import { buildQuote, NO_TOTAL } from "./quote";
import { NO_PAYMENT_HERE, NOT_KNOWN, QUOTE_SETTINGS } from "./settings";

/** The words of a finished quote, read back as a person's viewer reads them. */
const pdfText = async (bytes: Uint8Array): Promise<string> => allText(await readPages(bytes));

/**
 * The quote as a document (spec F-T5). It runs in the `pdf` project, with the other files that make
 * PDFs: one of these costs a second of processor time, and they run one at a time after the rest.
 *
 * The tests read the words back out of the finished file rather than out of the element tree, so
 * what is asserted is what a club would read on paper.
 */

describe("the quote PDF", () => {
  it("is made in under the specification's five seconds", async () => {
    const started = Date.now();
    const bytes = await buildQuotePdf(testQuote());
    expect(Date.now() - started).toBeLessThan(QUOTE_SETTINGS.budgetMs);
    expect(bytes.byteLength).toBeGreaterThan(1_000);
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
  });

  it("carries the number, the day, the validity and the link back", async () => {
    const quote = testQuote();
    const text = await pdfText(await buildQuotePdf(quote));
    expect(text).toContain(quote.number);
    expect(text).toContain(quote.issuedOn);
    expect(text).toContain(quote.validUntil);
    expect(text).toContain(`${QUOTE_SETTINGS.validityDays} days`);
    expect(text).toContain("/teamwear");
  });

  it("carries every line with its tier, its price each and its line total", async () => {
    const quote = testQuote();
    const text = await pdfText(await buildQuotePdf(quote));
    for (const line of quote.lines) {
      expect(text, line.label).toContain(line.articleCode);
      expect(text, line.label).toContain(line.unit);
      expect(text, line.label).toContain(line.tier);
    }
    expect(text).toContain(quote.total);
    expect(text).toContain(`${quote.tierQty} pieces in the basket`);
  });

  it("names the part the factory cannot price rather than leaving it off", async () => {
    const text = await pdfText(await buildQuotePdf(testQuote()));
    expect(text).toContain("Socks");
    expect(text).toContain("Not priced yet");
  });

  it("says what it does not know about delivery, rather than printing a date", async () => {
    const text = await pdfText(await buildQuotePdf(testQuote()));
    expect(text).toContain("No delivery date yet");
    expect(text).toContain(NO_DATE_YET.note);
    expect(text).not.toMatch(/Delivery 20[0-9]{2}-/);
  });

  it("prints the date when every part of the sum is on file", async () => {
    const text = await pdfText(await buildQuotePdf(buildQuote(quoteInput({ delivery: WITH_DATE }))));
    expect(text).toContain("2026-12-01");
  });

  it("states the VAT treatment and never adds tax to a figure", async () => {
    const text = await pdfText(await buildQuotePdf(testQuote()));
    expect(text).toContain("VAT treatment");
    expect(text).toContain("20%");
    expect(text).toContain("to confirm with a customs adviser");
  });

  it("says plainly that it has no VAT treatment when the rows hold none", async () => {
    const quote = buildQuote(
      quoteInput({ vat: { country: null, countryName: NOT_KNOWN, rate: NOT_KNOWN, text: "No market rule could be read.", label: NOT_KNOWN, ruleId: "R-GAP-000" } }),
    );
    const text = await pdfText(await buildQuotePdf(quote));
    expect(text).toContain("No market rule could be read.");
  });

  it("says what is included, and that Knitwright takes no money here", async () => {
    const text = await pdfText(await buildQuotePdf(testQuote()));
    expect(text).toContain("What is included");
    expect(text).toContain("Your crest");
    expect(text).toContain("Names and numbers");
    expect(text).toContain(NO_PAYMENT_HERE);
  });

  it("leaves no figure blank when the factory prices nothing", async () => {
    const quote = buildQuote(quoteInput({ currency: "AUD", unpriced: [] }));
    const text = await pdfText(await buildQuotePdf(quote));
    expect(text).toContain(NO_TOTAL);
    expect(text).toContain("No AUD price");
  });
});
