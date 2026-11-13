import { describe, expect, it, vi } from "vitest";
import { fakeC1 } from "./fixtures/c1";
import { memoryChannels } from "./fixtures/memory-store";
import { takeOrder } from "./intake";
import { standInAdmin } from "./shopify/stand-in";
import { receiveFulfilmentNotice } from "./shopify/fulfilment-notice";
import { signBody } from "./shopify/hmac";
import { syncTracking } from "./tracking";

const SHOP = "club.myshopify.com";

async function shipped() {
  const shipments = new Map([["order-shp-5001-11", { courier: "DHL", trackingNumber: "JD1" }]]);
  const memory = memoryChannels({ shipments });
  const id = await memory.store.connect({ brandId: "b1", userId: "u1", shop: SHOP, sealed: { ciphertext: "c", nonce: "n" }, scopes: "" });
  const base = { brandId: "b1", channel: "shopify" as const, connectionId: id, externalOrderId: "5001", orderName: "#1", productId: "p1", sizeLabel: "M", pieces: 1, shipTo: null, projectId: "pr", releaseId: "r", factoryProfileId: "f", fabricKey: "m", flags: [] };
  await takeOrder(fakeC1(memory.store).deps, { brandId: "b1", actor: "u1", description: "d", currency: "GBP", lines: [{ ...base, externalLineId: "11" }, { ...base, externalLineId: "12" }] });
  return { ...memory, id };
}

describe("tracking back to the shop (decision 0155)", () => {
  it("sends the first parcel's tracking once, and marks it sent", async () => {
    const { store, orders, id } = await shipped();
    const admin = standInAdmin();
    const send = vi.spyOn(admin, "sendTracking");
    const deps = { store, admin, shopOf: () => ({ shop: SHOP, accessToken: "t" }), log: vi.fn() };
    expect(await syncTracking(deps)).toEqual({ synced: 1, failed: 0 });
    expect(send).toHaveBeenCalledWith({ shop: SHOP, accessToken: "t" }, { orderId: "5001", courier: "DHL", trackingNumber: "JD1" });
    expect(orders[0]!.trackingSyncedAt).not.toBeNull();
    expect(await syncTracking(deps)).toEqual({ synced: 0, failed: 0 });
    expect(await syncTracking(deps, 50, "another")).toEqual({ synced: 0, failed: 0 });
    expect(id).toBeTruthy();
  });

  it("counts a failure, logs it, and tries again next time", async () => {
    const { store, orders } = await shipped();
    const admin = { ...standInAdmin(), sendTracking: vi.fn().mockRejectedValue(new Error("down")) };
    const log = vi.fn();
    expect(await syncTracking({ store, admin, shopOf: () => ({ shop: SHOP, accessToken: "t" }), log })).toEqual({ synced: 0, failed: 1 });
    expect(log).toHaveBeenCalled();
    expect(orders[0]!.trackingSyncedAt).toBeNull();
    expect(await syncTracking({ store, admin: standInAdmin(), shopOf: () => null, log })).toEqual({ synced: 0, failed: 1 });
  });
});

describe("the fulfilment-service callback", () => {
  it("accepts the shop's waiting requests once the HMAC is Shopify's", async () => {
    const { store } = await shipped();
    const admin = { ...standInAdmin(), acceptFulfilmentRequests: vi.fn().mockResolvedValue(2) };
    const deps = { secret: "s", store, admin, shopOf: () => ({ shop: SHOP, accessToken: "t" }), log: vi.fn() };
    const raw = '{"kind":"FULFILLMENT_REQUEST"}';
    expect(await receiveFulfilmentNotice(deps, raw, signBody("s", raw), SHOP)).toEqual({ status: 200, message: "Accepted 2." });
    expect(await receiveFulfilmentNotice(deps, raw, signBody("x", raw), SHOP)).toMatchObject({ status: 401 });
    expect(await receiveFulfilmentNotice(deps, raw, signBody("s", raw), "bad")).toMatchObject({ status: 400 });
    expect(await receiveFulfilmentNotice(deps, raw, signBody("s", raw), "else.myshopify.com")).toEqual({ status: 200, message: "No connection." });
    admin.acceptFulfilmentRequests.mockRejectedValueOnce(new Error("down"));
    expect(await receiveFulfilmentNotice(deps, raw, signBody("s", raw), SHOP)).toEqual({ status: 500, message: "Try again." });
  });
});
