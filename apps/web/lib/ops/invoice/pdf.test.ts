import { describe, expect, it } from "vitest";
import { readPdf } from "@/lib/flat/fixtures/pdf-read";
import { buildInvoice, type InvoiceSource } from "./model";
import { commercialInvoicePdf } from "./pdf";

const source: InvoiceSource = {
  order: {
    id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11",
    externalRef: "KW-0001",
    pieces: 10,
    sizes: { M: 6, L: 4 },
    valueMinor: 29_000,
    currency: "GBP",
    articleId: "football-shirt",
    factoryProfileId: "sialkot-partner",
  },
  brandName: "Rangers FC",
  article: { code: "JSY-SS-01", name: "Short sleeve jersey", hsCode: "6110.30", origin: "PK" },
  factory: { name: "Sialkot partner", city: "Sialkot", country: "PK" },
  destination: { country: "GB", name: "United Kingdom", preferenceScheme: "DCTS" },
  issuedOn: "2026-12-07",
  incoterms: "DAP",
};

const ready = (over: Partial<InvoiceSource> = {}) => {
  const built = buildInvoice({ ...source, ...over });
  if (built.status !== "ready") throw new Error("the fixture should build");
  return built.invoice;
};

describe("commercialInvoicePdf", () => {
  it("reads back with the HS code, the origin, the scheme and the amounts", async () => {
    const facts = await readPdf(await commercialInvoicePdf(ready()));
    expect(facts.startsAsPdf).toBe(true);
    for (const expected of ["Commercial invoice", "KW-0001", "6110.30", "Sialkot", "United Kingdom (GB)", "DCTS", "GBP 290.00", "DAP", "L ×4"]) {
      expect(facts.text, expected).toContain(expected);
    }
  }, 30_000);

  it("states no delivery date, and says why none is stated", async () => {
    const facts = await readPdf(await commercialInvoicePdf(ready()));
    expect(facts.text).toContain("No delivery date is stated");
    expect(facts.text).toContain("the days for QC and the freight days are not set");
  }, 30_000);

  it("prints what it cannot state instead of a figure nobody gave", async () => {
    const invoice = ready({
      article: { code: "SHO-TR-01", name: "Shorts", hsCode: null, origin: null },
      order: { ...source.order, valueMinor: null, currency: null },
      incoterms: "",
    });
    const facts = await readPdf(await commercialInvoicePdf(invoice));
    expect(facts.text).toContain("What this invoice cannot state");
    expect(facts.text).toContain("No HS code is on file for SHO-TR-01");
    expect(facts.text).toContain("Not stated");
    expect(facts.text).not.toContain("6110.30");
  }, 30_000);

  it("gives the same bytes twice, so a reprint is the same file", async () => {
    const [a, b] = [await commercialInvoicePdf(ready()), await commercialInvoicePdf(ready())];
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  }, 30_000);

  it("shows a character the font lacks as a question mark instead of garbling the line", async () => {
    const facts = await readPdf(await commercialInvoicePdf(ready({ brandName: "A中B" })));
    expect(facts.text).toContain("A?B");
  }, 30_000);

  it("says plainly when nothing is missing", async () => {
    expect((await readPdf(await commercialInvoicePdf(ready()))).text).toContain("Nothing: every field above came from a row.");
  }, 30_000);
});
