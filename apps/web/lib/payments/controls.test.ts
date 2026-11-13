import { describe, expect, it } from "vitest";
import { depositHeadroom, figureLines, minorFromText, toFigures } from "./controls";
import { linesForDatabase, toLine, toPayment } from "./store";
import { intent, priced } from "./fixtures/intents";

const ROW = {
  currency: "GBP",
  gmv_minor: "500000",
  collected_minor: 300_000,
  refunded_minor: 10_000,
  revenue_minor: 290_000,
  open_pre_order_minor: 400_000,
  reserve_minor: 40_000,
  deposits_minor: 100_000,
  headroom_minor: 150_000,
  reserve_bps: 1000,
};

describe("the F-G4 figures", () => {
  it("are read from the database's own sums", () => {
    expect(toFigures(ROW)).toMatchObject({ currency: "GBP", gmvMinor: 500_000, revenueMinor: 290_000, headroomMinor: 150_000, reserveBps: 1000 });
  });

  it("report GMV and revenue as two lines, never one", () => {
    const lines = figureLines(toFigures(ROW));
    expect(lines.find((line) => line.id === "gmv")?.value).toBe("£5,000.00");
    expect(lines.find((line) => line.id === "revenue")?.value).toBe("£2,900.00");
    expect(lines.find((line) => line.id === "reserve")?.note).toBe("10% of open pre-orders.");
    expect(lines.find((line) => line.id === "headroom")?.value).toBe("£1,500.00");
  });

  it("never offer a negative headroom", () => {
    expect(depositHeadroom(toFigures({ ...ROW, headroom_minor: -5 }))).toBe(0);
  });
});

describe("an amount typed by ops", () => {
  it("is read in minor units", () => {
    expect(minorFromText("1,250.50")).toBe(125_050);
    expect(minorFromText("£20")).toBe(2000);
    expect(minorFromText("0")).toBeNull();
    expect(minorFromText("12.345")).toBeNull();
    expect(minorFromText("lots")).toBeNull();
  });
});

describe("the rows", () => {
  it("of a payment and a line are read as the app uses them, and lines are written as the database reads them", () => {
    const id = crypto.randomUUID();
    const payment = toPayment({
      id, brand_id: null, purpose: "order", method: "card", status: "paid", currency: "GBP", order_value_minor: "100", amount_minor: 100,
      schedule: "full", balance_due_minor: 0, refunded_minor: 0, provider: "test", provider_session_id: "cs", provider_payment_id: "pi",
      credits: null, plan_id: null, plan_interval: null, description: "x", created_by: null, created_at: "2026-11-13",
    });
    expect(payment).toMatchObject({ id, orderValueMinor: 100, sessionId: "cs", providerPaymentId: "pi" });
    const line = intent(priced(100));
    const [written] = linesForDatabase([{ ...line, valueMinor: 100, priceLabel: "p" }]);
    expect(written).toMatchObject({ request_key: line.requestKey, value_minor: 100, price_label: "p", sizes: line.sizes });
    const read = toLine({ ...written, id: crypto.randomUUID(), payment_id: id, status: "waiting", order_id: null, run_id: null, message: null });
    expect(read).toMatchObject({ requestKey: line.requestKey, valueMinor: 100, status: "waiting", paymentId: id });
  });
});
