import { describe, expect, it } from "vitest";
import { shopSale, shopSaleRef } from "./payout";
import type { ShopOrder } from "./rows";

const ORDER: ShopOrder = {
  id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", brandId: "brand", listingId: "l", dropId: null, paymentId: "p", size: "M", qty: 2,
  amountMinor: 9000, currency: "GBP", personalName: null, personalNumber: null, batchId: null, accessHash: "h", createdAt: "c",
};
const COST = { status: "priced" as const, unitMinor: 1820, label: "First tier" };
const LISTING = { productId: "prod", title: "Home shirt" };
const FEE = { channel: "storefront" as const, currency: "GBP" as const, percentBps: 290, fixedMinor: 20, label: "Placeholder", isPlaceholder: true };

describe("a storefront sale for the seller's payout", () => {
  it("is the order at the listing's cost, with the channel and Knitwright fees, keyed on the order", () => {
    const sale = shopSale(ORDER, LISTING, COST, FEE, 500, "order-1");
    expect(sale).toEqual({
      brandId: "brand", channel: "storefront", sourceRef: `storefront:${ORDER.id}`, productId: "prod", productName: "Home shirt", quantity: 2, currency: "GBP",
      retailMinor: 9000, baseMinor: 3640, shippingMinor: 0, dutyMinor: 0, channelFeeMinor: 2 * (131 + 20), knitwrightFeeMinor: 2 * 225, orderId: "order-1",
    });
    expect(shopSaleRef(ORDER)).toBe(sale!.sourceRef);
  });

  it("records nothing with no cost on file, no brand, or a margin the fees take below nothing", () => {
    expect(shopSale(ORDER, LISTING, { status: "unpriced", reason: "" }, null, 0, null)).toBeNull();
    expect(shopSale({ ...ORDER, brandId: null }, LISTING, COST, null, 0, null)).toBeNull();
    expect(shopSale({ ...ORDER, amountMinor: 1900, qty: 1 }, LISTING, COST, FEE, 500, null)).toBeNull();
    expect(shopSale(ORDER, { productId: null, title: "" }, { ...COST, label: "" }, null, 0, null)).toMatchObject({ productName: "Storefront product", productId: null, channelFeeMinor: 0 });
    expect(shopSale({ ...ORDER, currency: "AUD" }, LISTING, COST, null, 0, null)).toMatchObject({ currency: "AUD", baseMinor: 3640 });
  });
});
