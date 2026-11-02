import { describe, expect, it, vi } from "vitest";
import { loadInvoiceSource } from "./load";
import { buildInvoice } from "./model";
import { loadIssuedInvoice, NO_SUCH_INVOICE } from "./record";
import type { OpsOrder } from "../rows";

const order: OpsOrder = {
  id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11",
  releaseId: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a12",
  brandId: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a13",
  projectId: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a14",
  externalRef: "KW-0001",
  factoryProfileId: "sialkot-partner",
  fabricKey: "mesh",
  articleId: "football-shirt",
  sizes: { M: 6, L: 4 },
  pieces: 10,
  valueMinor: 29_000,
  currency: "GBP",
  release: { label: "R1", number: 1, rosterHash: null },
  status: "ready",
  batchId: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a15",
  cutoffAt: "2026-12-01T12:00:00.000Z",
  leadTimeDays: null,
  promisedOn: null,
  createdAt: "2026-12-01T10:00:00.000Z",
};

const invoiceRow = (invoiceNo: number) => ({
  id: `6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a2${invoiceNo}`,
  order_id: order.id,
  invoice_no: invoiceNo,
  replaces_id: null,
  issued_on: "2026-12-07",
  origin_country: "PK",
  destination_country: "GB",
  preference_scheme: "DCTS",
  incoterms: "DAP",
  lines: [{ description: "Jersey", hsCode: "6110.30", originCountry: "PK", pieces: 10, unitValueMinor: 2900, lineValueMinor: 29_000 }],
  total_pieces: 10,
  total_value_minor: 29_000,
  currency: "GBP",
  missing: [],
  rule_id: "R-GAP-000",
  at: "2026-12-07T10:00:00Z",
});

/** One fake for both clients: the order, the invoices and the brand's name all answer from here. */
const client = (invoices: readonly unknown[]) => ({
  from: vi.fn((table: string) => {
    if (table === "ops_orders") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: order.id, release_id: order.releaseId, brand_id: order.brandId, project_id: order.projectId,
                external_ref: order.externalRef, factory_profile_id: order.factoryProfileId, fabric_key: order.fabricKey,
                article_id: order.articleId, sizes: order.sizes, pieces: order.pieces, value_minor: order.valueMinor,
                currency: order.currency, release_snapshot: { label: "R1", number: 1 }, status: order.status,
                batch_id: order.batchId, cutoff_at: order.cutoffAt, lead_time_days: null, promised_on: null,
                created_at: order.createdAt,
              },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "ops_commercial_invoices") return { select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: invoices, error: null }) }) }) }) };
    if (table === "brands") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { name: "Rangers FC" }, error: null }) }) }) };
    // The order's history, which loadOrder reads alongside the order.
    return { select: () => ({ eq: () => ({ order: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }) };
  }),
});

describe("loadIssuedInvoice", () => {
  it("gives the newest invoice when no number is asked for", async () => {
    const db = client([invoiceRow(2), invoiceRow(1)]);
    const loaded = await loadIssuedInvoice(db as never, db as never, order.id);
    expect(loaded.invoice.invoiceNo).toBe(2);
    expect(loaded.brandName).toBe("Rangers FC");
  });

  it("gives the invoice asked for, so a reprint of invoice 1 is invoice 1", async () => {
    const db = client([invoiceRow(2), invoiceRow(1)]);
    expect((await loadIssuedInvoice(db as never, db as never, order.id, 1)).invoice.invoiceNo).toBe(1);
  });

  it("refuses when the order has no invoice, and when the number asked for is not one of them", async () => {
    const empty = client([]);
    await expect(loadIssuedInvoice(empty as never, empty as never, order.id)).rejects.toThrow(NO_SUCH_INVOICE);
    const one = client([invoiceRow(1)]);
    await expect(loadIssuedInvoice(one as never, one as never, order.id, 9)).rejects.toThrow(NO_SUCH_INVOICE);
  });
});

const single = (data: unknown) => ({ select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data, error: null }) }) }) }) });

describe("loadInvoiceSource", () => {
  it("gathers the article, the factory and the destination rule into one source", async () => {
    const reads = vi.fn((table: string) => {
      if (table === "base_articles") return single({ code: "JSY-SS-01", name: "Jersey", hs_code: "6110.30", origin: "PK" });
      if (table === "factories") return single({ name: "Sialkot partner", city: "Sialkot", country: "PK" });
      return single({ country: "GB", name: "United Kingdom", preference_scheme: "DCTS" });
    });
    const source = await loadInvoiceSource({ from: reads } as never, { from: reads } as never, {
      order,
      brandName: "Rangers FC",
      destinationCountry: "GB",
      issuedOn: "2026-12-07",
      incoterms: "DAP",
    });
    expect(source.order).toMatchObject({ externalRef: "KW-0001", factoryProfileId: "sialkot-partner", pieces: 10 });
    const built = buildInvoice(source);
    expect(built.status).toBe("ready");
    if (built.status === "ready") expect(built.invoice.lines[0]?.hsCode).toBe("6110.30");
  });

  it("gathers nulls where nothing is on file, and the invoice then names the gates", async () => {
    const reads = vi.fn(() => single(null));
    const source = await loadInvoiceSource({ from: reads } as never, { from: reads } as never, {
      order,
      brandName: "Rangers FC",
      destinationCountry: "ZZ",
      issuedOn: "2026-12-07",
      incoterms: "",
    });
    expect([source.article, source.factory, source.destination]).toEqual([null, null, null]);
    expect(buildInvoice(source).status).toBe("blocked");
  });
});
