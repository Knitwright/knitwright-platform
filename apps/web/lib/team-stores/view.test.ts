import { describe, expect, it } from "vitest";
import { buyerOutcome } from "./receipt";
import { FIXTURE_LADDER, NOW, fixturePurchase, fixtureStore } from "./fixtures/stores";
import { isPaid, toPurchase, toStore } from "./model";
import { defaultDates, previewPrice } from "./preview";
import { namesList, paidPieces, storeCard } from "./view";

const SITE = "https://knitwright.example";

describe("a store card", () => {
  it("reads like the Store screen's card: closes in, pieces against the minimum, margin, link", () => {
    const card = storeCard(fixtureStore(), [fixturePurchase({ pieces: 3 }), fixturePurchase({ paymentStatus: "open", pieces: 5 })], NOW, SITE);
    expect(card).toMatchObject({
      state: "open",
      stateLabel: "Open",
      tone: "ok",
      when: "Closes in 8 days",
      progress: "3 of 10 pieces minimum",
      percent: 30,
      price: "£31.90 a piece",
      margin: "Club margin 10% (£2.90 a piece)",
      link: "https://knitwright.example/t/Ab3dEf7hJk",
      canEnd: true,
    });
  });

  it("after close says what happened and what the club is owed", () => {
    const closed = storeCard(fixtureStore({ status: "closed", piecesSold: 18, marginOwedMinor: 5220 }), [], NOW, SITE);
    expect(closed).toMatchObject({ stateLabel: "Order sent", progress: "18 of 10 pieces minimum", percent: 100, canEnd: false });
    expect(closed.margin).toBe("Club margin 10% (£2.90 a piece) · £52.20 to the club");
    const refunded = storeCard(fixtureStore({ status: "refunded", piecesSold: 4, marginBps: 0, closeMessage: "Below the minimum." }), [], NOW, SITE);
    expect(refunded).toMatchObject({ stateLabel: "Refunded", tone: "neutral", progress: "4 pieces bought, 10 needed", margin: "No club margin", message: "Below the minimum." });
    expect(storeCard(fixtureStore({ opensAt: "2026-11-20T00:00:00Z" }), [], NOW, SITE)).toMatchObject({ stateLabel: "Not open yet", canEnd: true });
  });

  it("lists the paid pieces' names and numbers, upper case, and nobody who has not paid", () => {
    const rows = namesList([fixturePurchase({ lines: [{ sizeLabel: "M", printName: "Khan", printNumber: "10" }] }), fixturePurchase({ paymentStatus: "refunded" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ size: "M", name: "KHAN", number: "10", buyer: "Sam Parent" });
    expect(paidPieces([fixturePurchase({ pieces: 2 }), fixturePurchase({ paymentStatus: "paid" })])).toBe(3);
    expect(isPaid({ paymentStatus: "expired" })).toBe(false);
  });
});

describe("the price line", () => {
  it("prices a piece at the minimum's tier plus the margin", () => {
    expect(previewPrice(FIXTURE_LADDER, 10, 1000)).toMatchObject({ ok: true, pieceMinor: 3190 });
    expect(previewPrice(FIXTURE_LADDER, 20, 0)).toMatchObject({ ok: true, pieceMinor: 2500 });
    expect(previewPrice(FIXTURE_LADDER, 20, 0).text).toContain("No club margin.");
    expect(previewPrice(FIXTURE_LADDER, 10, 1000).text).toContain("The club keeps £2.90 a piece (10%)");
  });

  it("refuses a minimum below the ladder, an empty ladder and a minimum that is not a number", () => {
    expect(previewPrice(FIXTURE_LADDER, 5, 0)).toMatchObject({ ok: false });
    expect(previewPrice([], 10, 0).text).toMatch(/needs a price/);
    expect(previewPrice(FIXTURE_LADDER, Number.NaN, 0).text).toBe("Type a minimum of 1 piece or more.");
  });

  it("starts the form today, for two weeks", () => {
    expect(defaultDates(NOW)).toEqual({ opensOn: "2026-11-13", closesOn: "2026-11-27" });
  });
});

describe("the buyer's return page", () => {
  const store = fixtureStore();
  it("says paid, waiting, cancelled, being refunded or refunded", () => {
    expect(buyerOutcome({ status: "fulfilled", amountMinor: 3190, refundedMinor: 0 }, false, store)).toMatchObject({ title: "Paid. Thank you", tone: "ok" });
    expect(buyerOutcome({ status: "paid", amountMinor: 3190, refundedMinor: 0 }, false, store).body).toContain("20 November");
    expect(buyerOutcome({ status: "open", amountMinor: 3190, refundedMinor: 0 }, false, store).title).toBe("Confirming your payment");
    expect(buyerOutcome({ status: "open", amountMinor: 3190, refundedMinor: 0 }, true, store).title).toBe("Not paid");
    expect(buyerOutcome({ status: "expired", amountMinor: 3190, refundedMinor: 0 }, false, store).title).toBe("Not paid");
    expect(buyerOutcome({ status: "fulfilled", amountMinor: 3190, refundedMinor: 0 }, false, { ...store, status: "refunding" }).title).toBe("Paid, and being refunded");
    expect(buyerOutcome({ status: "refunded", amountMinor: 3190, refundedMinor: 3190 }, false, store).body).toContain("£31.90");
  });
});

describe("the rows", () => {
  it("read a store and a purchase as the database gives them", () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000a01", brand_id: "00000000-0000-4000-8000-000000000b01", code: "Ab3dEf7hJk", title: "Kit",
      project_id: "00000000-0000-4000-8000-000000000c01", product_id: "00000000-0000-4000-8000-000000000d01", release_id: "00000000-0000-4000-8000-000000000e01",
      factory_profile_id: "f", fabric_key: "m", flags: [], currency: "GBP", unit_minor: "2900", price_label: "p", margin_bps: 500, margin_minor: 145,
      sizes: ["M"], names_numbers: false, name_max: 1, number_min: 0, number_max: 99, min_pieces: 10, season_id: null,
      opens_at: "2026-11-10T00:00:00Z", closes_at: "2026-11-20T00:00:00Z", status: "closing", pieces_sold: 12, close_sizes: { M: 12 },
      close_request_key: "team-store:x", order_id: null, close_message: null, margin_owed_minor: 1740, closed_at: null, created_by: null,
    };
    expect(toStore(row)).toMatchObject({ unitMinor: 2900, marginMinor: 145, closeSizes: { M: 12 }, status: "closing", createdBy: null });
    const purchase = toPurchase({
      id: "00000000-0000-4000-8000-000000000a02", payment_id: "00000000-0000-4000-8000-000000000a03", buyer_name: "Sam", buyer_email: "s@example.test", pieces: 2, amount_minor: 6380, counted: false,
      order_payments: null,
      team_store_order_lines: [{ position: 2, size_label: "L", print_name: "", print_number: "" }, { position: 1, size_label: "S", print_name: "ALI", print_number: "7" }],
    });
    expect(purchase.paymentStatus).toBe("open");
    expect(purchase.lines.map((one) => one.sizeLabel)).toEqual(["S", "L"]);
  });
});
