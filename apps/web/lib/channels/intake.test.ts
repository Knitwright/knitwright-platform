import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { fakeC1 } from "./fixtures/c1";
import { memoryChannels } from "./fixtures/memory-store";
import { invoiceCurrency, NO_ACTOR, requestKeyOf, takeOrder, type ResolvedLine } from "./intake";

const line = (over: Partial<ResolvedLine> = {}): ResolvedLine => ({
  brandId: "b1",
  channel: "shopify",
  connectionId: "c1",
  externalOrderId: "5001",
  externalLineId: "11",
  orderName: "#1042",
  productId: "p1",
  sizeLabel: "M",
  pieces: 2,
  shipTo: null,
  projectId: "pr1",
  releaseId: "r1",
  factoryProfileId: "knitwright-default",
  fabricKey: "mesh",
  flags: [{ code: "checklist", text: "Note" }],
  ...over,
});

const order = (lines: readonly ResolvedLine[], actor: string | null = "u1") => ({ brandId: "b1", actor, description: "Shopify order #1042", currency: "GBP", lines });

describe("taking in a channel's order (decision 0155)", () => {
  it("records each line, opens one invoice for the order and sends it through C1's fulfilment", async () => {
    const { store, orders } = memoryChannels();
    const c1 = fakeC1(store);
    const result = await takeOrder(c1.deps, order([line(), line({ externalLineId: "12", sizeLabel: "L", pieces: 1 })]));
    expect(result).toEqual({ received: 2, submitted: 2, refused: 0, messages: [] });
    const payment = [...c1.payments.values()][0]!;
    expect(payment).toMatchObject({ brandId: "b1", userId: "u1", currency: "GBP" });
    expect(payment.lines[0]).toMatchObject({ requestKey: "shp-5001-11", door: "brand_run", kind: "run", sizes: { M: 2 }, pieces: 2, valueMinor: null, priceLabel: null });
    expect(payment.lines[0]!.flags[0]!.code).toBe("channel_shopify");
    expect(payment.lines[0]!.flags).toContainEqual({ code: "checklist", text: "Note" });
    expect(orders.map((one) => [one.state, one.orderId])).toEqual([["submitted", "order-shp-5001-11"], ["submitted", "order-shp-5001-12"]]);
  });

  it("does nothing new when the same order arrives again", async () => {
    const { store } = memoryChannels();
    const c1 = fakeC1(store);
    await takeOrder(c1.deps, order([line()]));
    expect(await takeOrder(c1.deps, order([line()]))).toEqual({ received: 0, submitted: 0, refused: 0, messages: [] });
    expect(c1.payments.size).toBe(1);
  });

  it("settles a line the database refuses with its words, and sends the rest", async () => {
    const { store, orders } = memoryChannels();
    const c1 = fakeC1(store, { refuse: new Map([["p2", "The artwork is below 150 DPI."]]) });
    const result = await takeOrder(c1.deps, order([line(), line({ externalLineId: "12", productId: "p2" })]));
    expect(result).toEqual({ received: 2, submitted: 1, refused: 1, messages: ["The artwork is below 150 DPI."] });
    expect(orders[1]).toMatchObject({ state: "refused", message: "The artwork is below 150 DPI." });
  });

  it("refuses every line when nobody who may order is linked, or when the invoice is refused", async () => {
    const one = memoryChannels();
    expect(await takeOrder(fakeC1(one.store).deps, order([line()], null))).toMatchObject({ refused: 1, messages: [NO_ACTOR] });
    const two = memoryChannels();
    const refused = fakeC1(two.store, { openRefusal: new AppError("forbidden", "You may not order for this brand.") });
    expect(await takeOrder(refused.deps, order([line()]))).toMatchObject({ refused: 1, messages: ["You may not order for this brand."] });
    expect(two.orders[0]!.state).toBe("refused");
  });

  it("lets an internal failure through, leaving the line to be sent again", async () => {
    const { store, orders } = memoryChannels();
    await expect(takeOrder(fakeC1(store, { openRefusal: new AppError("internal", "db down") }).deps, order([line()]))).rejects.toThrow("db down");
    await expect(takeOrder(fakeC1(store, { fail: true }).deps, order([line()]))).rejects.toThrow("boom");
    expect(orders[0]!.state).toBe("received");
    expect(await takeOrder(fakeC1(store).deps, order([line()]))).toMatchObject({ received: 1, submitted: 1 });
  });

  it("names the request key and currency as C1 needs them", () => {
    expect(requestKeyOf({ channel: "csv", externalOrderId: "club-7", externalLineId: "1" })).toBe("csv-club-7-1");
    expect(requestKeyOf({ channel: "shopify", externalOrderId: "9".repeat(40), externalLineId: "9".repeat(40) })).toHaveLength(64);
    expect([invoiceCurrency("AUD"), invoiceCurrency("GBP"), invoiceCurrency("EUR")]).toEqual(["AUD", "GBP", "GBP"]);
  });
});
