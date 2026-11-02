import { describe, expect, it } from "vitest";
import { quoteDisposition, quoteFileName, quoteHref, QUOTE_PATH, quoteQuerySchema, quoteResponse } from "./download";
import { testQuote } from "./fixtures/quote";
import { NOTHING_TO_QUOTE, quoteSource } from "./source";

const query = (href: string) => {
  const url = new URL(href, "https://app.knitwright.com");
  const found: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    found[key] = values.length > 1 ? values : values[0]!;
  }
  return quoteQuerySchema.parse(found);
};

describe("the address a quote is downloaded from", () => {
  it("carries the sport, the market, the club and the basket, and no price", () => {
    const href = quoteHref({
      sportId: "football",
      currency: "GBP",
      clubName: "Sialkot Rovers",
      lines: [
        { articleCode: "JSY-SS-01", qty: 20 },
        { articleCode: "SHO-TR-01", qty: 20 },
      ],
      unpriced: ["Socks"],
      crest: true,
      namesNumbers: true,
      sponsors: 2,
    });
    expect(href.startsWith(`${QUOTE_PATH}?`)).toBe(true);
    // "unpriced" names a part, not a figure: no money and no minor units travel in an address.
    expect(href).not.toMatch(/[£$]|minor|[0-9]+p\b/i);
    expect(query(href)).toMatchObject({
      sport: "football",
      market: "GBP",
      clubName: "Sialkot Rovers",
      lines: [
        { articleCode: "JSY-SS-01", qty: 20 },
        { articleCode: "SHO-TR-01", qty: 20 },
      ],
      unpriced: ["Socks"],
      crest: true,
      names: true,
      sponsors: 2,
    });
  });

  it("leaves out what it does not have, and reads the leftovers as off", () => {
    const href = quoteHref({ sportId: "football", currency: "AUD", clubName: null, lines: [{ articleCode: "JSY-SS-01", qty: 10 }] });
    expect(href).not.toContain("club=");
    expect(query(href)).toMatchObject({ clubName: null, unpriced: [], crest: false, names: false, sponsors: 0 });
  });

  it("drops a basket line that is not one, rather than guessing a quantity", () => {
    expect(query(`${QUOTE_PATH}?sport=football&market=GBP&line=NOT-A-CODE:20&line=JSY-SS-01:5`).lines).toEqual([{ articleCode: "JSY-SS-01", qty: 5 }]);
  });

  it("refuses a sport or a market the platform does not sell into", () => {
    expect(() => query(`${QUOTE_PATH}?sport=quidditch&market=GBP`)).toThrow();
    expect(() => query(`${QUOTE_PATH}?sport=football&market=USD`)).toThrow();
  });

  it("takes an empty club name as none, so a heading is never blank", () => {
    expect(query(`${QUOTE_PATH}?sport=football&market=GBP&club=`).clubName).toBeNull();
  });
});

describe("the file a quote is saved as", () => {
  it("is named after the quote's own number and is safe in a header", () => {
    const quote = testQuote();
    const name = quoteFileName(quote);
    expect(name.plain).toBe(`${quote.number}-quote.pdf`);
    expect(name.plain).toMatch(/^[A-Za-z0-9_.-]+$/);
    expect(name.original).toBe(name.plain);
    expect(quoteDisposition(quote)).toBe(`attachment; filename="${name.plain}"`);
  });

  it("is sent once, as an attachment nobody may cache", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const response = quoteResponse(testQuote(), bytes);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-length")).toBe("3");
  });
});

describe("the configurator's Quote button", () => {
  const source = quoteSource({ sportId: "football", clubName: "Sialkot Rovers", now: () => new Date("2026-11-02T09:00:00.000Z") });

  it("hands back the number the document will carry and where the document is", async () => {
    const outcome = await source.quoteFor({
      projectId: "project-1",
      version: 3,
      currency: "GBP",
      lines: [{ articleCode: "JSY-SS-01", qty: 20 }],
    });
    expect(outcome.status).toBe("quoted");
    if (outcome.status !== "quoted") return;
    expect(outcome.quoteNumber).toMatch(/^KWQ-20261102-[A-Z2-9]{6}$/);
    expect(query(outcome.downloadPath)).toMatchObject({ sport: "football", market: "GBP", clubName: "Sialkot Rovers" });
  });

  it("says plainly that there is nothing to quote, rather than making an empty document", async () => {
    expect(await source.quoteFor({ projectId: "p", version: 1, currency: "GBP", lines: [] })).toEqual({ status: "unavailable", reason: NOTHING_TO_QUOTE });
  });

  it("falls back to the design's own reference when the screen has no club name", async () => {
    const plain = quoteSource({ sportId: "football", clubName: null });
    const outcome = await plain.quoteFor({ projectId: "project-9", version: 1, currency: "GBP", lines: [{ articleCode: "JSY-SS-01", qty: 20 }] });
    expect(outcome.status).toBe("quoted");
    if (outcome.status !== "quoted") return;
    expect(outcome.downloadPath).not.toContain("club=");
  });
});
