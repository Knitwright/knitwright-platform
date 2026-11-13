import { describe, expect, it } from "vitest";
import { importTemplate, MAX_IMPORT_ROWS, parseCsv, readOrdersCsv, toCsv } from "./csv";
import { orderRows, productRows } from "./export-rows";
import { skuOf } from "./sku";
import type { ChannelOrderRow, ListingRow } from "./store";

const P = "0f6c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b";

describe("CSV out (decision 0155)", () => {
  it("quotes what needs quoting and writes a would-be formula as text", () => {
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"'], ["=SUM(A1)", null], [-5, "+1"]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n\'=SUM(A1),\r\n\'-5,\'+1\r\n');
  });

  it("writes a row per product and size with its SKU and Shopify price", () => {
    const listing = { productId: P, sizeLabel: "M", priceMinor: 3500, currency: "GBP", externalProductId: "7" } as ListingRow;
    expect(productRows([{ productId: P, name: "Home", stage: "run", sizes: ["M", "L"] }], [listing])).toEqual([
      [skuOf(P, "M"), P, "Home", "M", "run", "35.00", "GBP", "7"],
      [skuOf(P, "L"), P, "Home", "L", "run", null, null, null],
    ]);
  });

  it("writes the channel orders with product names", () => {
    const order = { receivedAt: "t", channel: "csv", orderName: "CSV 1", externalLineId: "1", productId: P, sizeLabel: "M", pieces: 2, state: "submitted", message: null, orderId: "o", trackingSyncedAt: null } as ChannelOrderRow;
    expect(orderRows([order], [{ productId: P, name: "Home" }])).toEqual([["t", "csv", "CSV 1", "1", "Home", "M", 2, "submitted", null, "o", null]]);
    expect(orderRows([order], [])[0]![4]).toBe(P);
  });
});

describe("CSV in", () => {
  it("parses quoted fields, doubled quotes, CRLF and a byte-order mark, dropping blank lines", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","q""q"\n\n,last')).toEqual([["a", "b"], ["x, y", 'q"q'], ["", "last"]]);
    expect(parseCsv("a\rb")).toEqual([["a"], ["b"]]);
  });

  it("reads orders, numbering lines per order and keeping the ship-to", () => {
    const text = `order_ref,sku,quantity,ship_name,ship_postcode,ship_country\n1001,${skuOf(P, "M")},2,Sam,LS1,gb\n1001,${skuOf(P, "L")},1,,,\n1002,${skuOf(P, "M")},3,,,`;
    const read = readOrdersCsv(text);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.lines.map((line) => [line.orderRef, line.lineNo, line.size, line.quantity])).toEqual([["1001", 1, "M", 2], ["1001", 2, "L", 1], ["1002", 1, "M", 3]]);
    expect(read.lines[0]!.shipTo).toMatchObject({ name: "Sam", postcode: "LS1", country: "GB" });
    expect(read.lines[1]!.shipTo).toBeNull();
    expect(read.lines[0]!.productId).toBe(P);
  });

  it("refuses the whole file with each row's problem", () => {
    const read = readOrdersCsv(`order_ref,sku,quantity\nbad ref!,${skuOf(P, "M")},1\n1,SHOP-SKU,1\n2,${skuOf(P, "M")},0`);
    expect(read).toEqual({ ok: false, problems: [expect.stringMatching(/^Row 2: order_ref/), expect.stringMatching(/^Row 3: the SKU/), expect.stringMatching(/^Row 4: quantity/)] });
    expect(readOrdersCsv("")).toEqual({ ok: false, problems: ["The file is empty."] });
    expect(readOrdersCsv("sku,quantity\n")).toMatchObject({ ok: false, problems: [expect.stringContaining("missing: order_ref")] });
    expect(readOrdersCsv("order_ref,sku,quantity\n")).toEqual({ ok: false, problems: ["The file has no orders."] });
    expect(readOrdersCsv(`order_ref,sku,quantity\n${"1,x,1\n".repeat(MAX_IMPORT_ROWS + 1)}`)).toMatchObject({ ok: false, problems: [expect.stringContaining("At most")] });
    expect(readOrdersCsv("x".repeat(300 * 1024))).toMatchObject({ ok: false, problems: [expect.stringContaining("256 KB")] });
  });

  it("gives a template that reads back", () => {
    expect(readOrdersCsv(importTemplate(skuOf(P, "M"))).ok).toBe(true);
  });
});
