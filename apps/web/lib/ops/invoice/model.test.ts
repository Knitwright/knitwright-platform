import { describe, expect, it, vi } from "vitest";
import { articleForOrder, destinationRule, factoryForOrder, listDestinations } from "./load";
import { buildInvoice, linesForRecord, NO_DELIVERY_DATE, type InvoiceSource } from "./model";
import { money } from "./pdf";
import { invoiceFromRecord } from "./record";
import { issueInvoiceSchema } from "./schemas";
import { issueInvoice, listInvoices, toIssuedInvoice } from "./service";

const order = {
  id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11",
  externalRef: "KW-0001",
  pieces: 10,
  sizes: { M: 6, L: 4 },
  valueMinor: 29_000,
  currency: "GBP",
  articleId: "football-shirt",
  factoryProfileId: "sialkot-partner",
};

const source = (over: Partial<InvoiceSource> = {}): InvoiceSource => ({
  order,
  brandName: "Rangers FC",
  article: { code: "JSY-SS-01", name: "Short sleeve jersey", hsCode: "6110.30", origin: "PK" },
  factory: { name: "Sialkot partner", city: "Sialkot", country: "PK" },
  destination: { country: "GB", name: "United Kingdom", preferenceScheme: "DCTS" },
  issuedOn: "2026-12-07",
  incoterms: "DAP",
  ...over,
});

describe("buildInvoice", () => {
  it("takes the HS code, the origin and the scheme from the rows, and states no delivery date", () => {
    const built = buildInvoice(source());
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;
    expect(built.invoice.lines[0]).toEqual({
      description: "Short sleeve jersey (JSY-SS-01)",
      hsCode: "6110.30",
      originCountry: "PK",
      pieces: 10,
      unitValueMinor: 2900,
      lineValueMinor: 29_000,
    });
    expect([built.invoice.preferenceScheme, built.invoice.originCountry, built.invoice.missing]).toEqual(["DCTS", "PK", []]);
    expect(built.invoice.dateNote).toBe(NO_DELIVERY_DATE);
  });

  it("blocks on a factory that is not on file, and says where to add it", () => {
    const built = buildInvoice(source({ factory: null }));
    expect(built.status).toBe("blocked");
    if (built.status === "blocked") expect(built.blockers[0]).toContain("/ops/factories");
  });

  it("blocks until a destination is chosen", () => {
    const built = buildInvoice(source({ destination: null }));
    expect(built.status === "blocked" && built.blockers[0]).toContain("Choose the country");
  });

  it("leaves an HS code that is not on file blank and names it, rather than guessing a heading", () => {
    const built = buildInvoice(source({ article: { code: "SHO-TR-01", name: "Shorts", hsCode: null, origin: "PK" } }));
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;
    expect(built.invoice.lines[0]?.hsCode).toBeNull();
    expect(built.invoice.missing.join(" ")).toContain("No HS code is on file for SHO-TR-01");
  });

  it("falls back to the factory's country when the article states no origin, and says so", () => {
    const built = buildInvoice(source({ article: { code: "SHO-TR-01", name: "Shorts", hsCode: "6104.63", origin: null } }));
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;
    expect(built.invoice.lines[0]?.originCountry).toBe("PK");
    expect(built.invoice.missing.join(" ")).toContain("states no origin");
  });

  it("names the order's own article when no catalogue article matches", () => {
    const built = buildInvoice(source({ article: null }));
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;
    expect(built.invoice.lines[0]).toMatchObject({ description: "football-shirt", hsCode: null, originCountry: "PK" });
    expect(built.invoice.missing.join(" ")).toContain("No catalogue article matches");
  });

  it("states no amount when the Store gave none, and no terms when none are agreed", () => {
    const built = buildInvoice(source({ order: { ...order, valueMinor: null, currency: null }, incoterms: "  " }));
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;
    expect([built.invoice.totalValueMinor, built.invoice.lines[0]?.unitValueMinor]).toEqual([null, null]);
    expect(built.invoice.missing.join(" ")).toContain("gave no value");
    expect(built.invoice.missing.join(" ")).toContain("No terms of delivery");
  });

  it("gives the record the same lines the document shows", () => {
    const built = buildInvoice(source());
    expect(built.status === "ready" && linesForRecord(built.invoice)).toEqual([
      { description: "Short sleeve jersey (JSY-SS-01)", hsCode: "6110.30", originCountry: "PK", pieces: 10, unitValueMinor: 2900, lineValueMinor: 29_000 },
    ]);
  });
});

describe("money on the document", () => {
  it("writes an amount with its currency, and says plainly when there is none", () => {
    expect(money(29_000, "GBP")).toBe("GBP 290.00");
    expect(money(null, "GBP")).toBe("Not stated");
    expect(money(100, null)).toBe("Not stated");
  });
});

const record = {
  id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a21",
  order_id: order.id,
  invoice_no: 1,
  replaces_id: null,
  issued_on: "2026-12-07",
  origin_country: "PK",
  destination_country: "GB",
  preference_scheme: "DCTS",
  incoterms: "DAP",
  lines: [{ description: "Short sleeve jersey (JSY-SS-01)", hsCode: "6110.30", originCountry: "PK", pieces: 10, unitValueMinor: 2900, lineValueMinor: 29_000 }],
  total_pieces: 10,
  total_value_minor: 29_000,
  currency: "GBP",
  missing: [],
  rule_id: "R-GAP-000",
  at: "2026-12-07T10:00:00Z",
};

describe("the record", () => {
  it("reads an issued invoice", () => {
    expect(toIssuedInvoice(record)).toMatchObject({ invoiceNo: 1, preferenceScheme: "DCTS", replacesId: null });
  });

  it("builds the document from what was issued, not from the rows as they are now", () => {
    const changed = { ...order, sizes: { M: 10 } };
    const built = invoiceFromRecord(changed as never, "Rangers FC", toIssuedInvoice(record));
    expect(built.lines[0]?.hsCode).toBe("6110.30");
    expect(built.totalPieces).toBe(10);
    expect(built.dateNote).toBe(NO_DELIVERY_DATE);
  });
});

describe("issueInvoice", () => {
  it("sends every field to the database and reads the number it gave", async () => {
    const built = buildInvoice(source());
    const rpc = vi.fn().mockResolvedValue({ data: [{ invoice_id: record.id, invoice_no: 2 }], error: null });
    if (built.status !== "ready") throw new Error("not ready");
    expect(await issueInvoice({ rpc } as never, "actor", built.invoice, { replacesId: record.id })).toEqual({ id: record.id, invoiceNo: 2 });
    expect(rpc).toHaveBeenCalledWith("ops_issue_commercial_invoice", expect.objectContaining({ p_origin_country: "PK", p_destination_country: "GB", p_preference_scheme: "DCTS", p_replaces_id: record.id }));
  });

  it("refuses when the database does, and when it answers with nothing", async () => {
    const built = buildInvoice(source());
    if (built.status !== "ready") throw new Error("not ready");
    const bad = vi.fn().mockResolvedValue({ data: null, error: { message: "raw", hint: "not_invoiceable" } });
    await expect(issueInvoice({ rpc: bad } as never, "a", built.invoice)).rejects.toThrow();
    const empty = vi.fn().mockResolvedValue({ data: [], error: null });
    await expect(issueInvoice({ rpc: empty } as never, "a", built.invoice)).rejects.toThrow(/answered with nothing/);
  });
});

const single = (data: unknown) => ({ select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data, error: null }) }) }) }) });

describe("the reads", () => {
  it("finds the catalogue article by the registry type the order names", async () => {
    const from = vi.fn(() => single({ code: "JSY-SS-01", name: "Jersey", hs_code: "6110.30", origin: "PK" }));
    expect(await articleForOrder({ from } as never, "football-shirt")).toEqual({ code: "JSY-SS-01", name: "Jersey", hsCode: "6110.30", origin: "PK" });
  });

  it("answers null where nothing is on file, so the document names the gap", async () => {
    const from = vi.fn(() => single(null));
    expect(await articleForOrder({ from } as never, "nothing")).toBeNull();
    expect(await factoryForOrder({ from } as never, "nothing")).toBeNull();
    expect(await destinationRule({ from } as never, "ZZ")).toBeNull();
  });

  it("reads the factory and the destination rule", async () => {
    const factory = vi.fn(() => single({ name: "Sialkot partner", city: "Sialkot", country: "PK" }));
    expect(await factoryForOrder({ from: factory } as never, "sialkot-partner")).toEqual({ name: "Sialkot partner", city: "Sialkot", country: "PK" });
    const rule = vi.fn(() => single({ country: "GB", name: "United Kingdom", preference_scheme: "DCTS" }));
    expect(await destinationRule({ from: rule } as never, "GB")).toEqual({ country: "GB", name: "United Kingdom", preferenceScheme: "DCTS" });
  });

  it("lists the countries an invoice may name, and gives none when the read fails", async () => {
    const ok = vi.fn(() => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [{ country: "GB", name: "United Kingdom", preference_scheme: "DCTS" }], error: null }) }) }) }));
    expect(await listDestinations({ from: ok } as never)).toHaveLength(1);
    const bad = vi.fn(() => ({ select: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: "no" } }) }) }) }));
    expect(await listDestinations({ from: bad } as never)).toEqual([]);
  });

  it("lists an order's invoices, newest first", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [record], error: null });
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ order: () => ({ limit }) }) }) }));
    expect(await listInvoices({ from } as never, order.id)).toHaveLength(1);
  });
});

describe("the form", () => {
  it("needs a destination and a real day", () => {
    expect(issueInvoiceSchema.safeParse({ orderId: order.id, destinationCountry: "GB", issuedOn: "2026-12-07" }).success).toBe(true);
    expect(issueInvoiceSchema.safeParse({ orderId: order.id, destinationCountry: "gb", issuedOn: "2026-12-07" }).success).toBe(false);
    expect(issueInvoiceSchema.safeParse({ orderId: order.id, destinationCountry: "GB", issuedOn: "2026-02-31" }).success).toBe(false);
  });
});
