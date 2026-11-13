import { describe, expect, it } from "vitest";
import type { ChannelFee } from "@/lib/store-pages/margin";
import { fixturePurchase, fixtureStore } from "./fixtures/stores";
import { saleRef, storeSale } from "./payout";

const FEE: ChannelFee = { channel: "team_store", currency: "GBP", percentBps: 150, fixedMinor: 20, label: "Placeholder card fee", isPlaceholder: true };

describe("the club's margin as a seller sale", () => {
  it("is C5's margin over the store's own prices: retail and base per piece, the channel fee, no freight or duty", () => {
    const purchase = fixturePurchase({ pieces: 2, paymentId: "00000000-0000-4000-9000-0000000000aa" });
    const sale = storeSale(fixtureStore(), purchase, FEE, 0, null);
    expect(sale).toEqual({
      brandId: fixtureStore().brandId,
      channel: "team_store",
      sourceRef: "team-store:00000000-0000-4000-9000-0000000000aa",
      productId: fixtureStore().productId,
      productName: "U16s home kit",
      quantity: 2,
      currency: "GBP",
      retailMinor: 6380,
      baseMinor: 5800,
      shippingMinor: 0,
      dutyMinor: 0,
      // 1.5% of £31.90 is 48p, plus 20p, on each piece.
      channelFeeMinor: 136,
      knitwrightFeeMinor: 0,
      orderId: null,
    });
    expect(saleRef(purchase)).toBe(sale?.sourceRef);
    expect(storeSale(fixtureStore(), purchase, null, 100, "00000000-0000-4000-8000-0000000000aa")).toMatchObject({ channelFeeMinor: 0, knitwrightFeeMinor: 64, orderId: "00000000-0000-4000-8000-0000000000aa" });
  });

  it("records nothing where there is nothing to pay the club", () => {
    expect(storeSale(fixtureStore({ marginBps: 0, marginMinor: 0 }), fixturePurchase(), FEE, 0, null)).toBeNull();
    expect(storeSale(fixtureStore({ marginBps: 500, marginMinor: 5 }), fixturePurchase(), FEE, 0, null)).toBeNull();
    expect(storeSale(fixtureStore({ currency: "AUD" }), fixturePurchase(), { ...FEE, currency: "AUD" }, 0, null)?.currency).toBe("AUD");
  });
});
