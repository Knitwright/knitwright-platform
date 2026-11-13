import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import { getOrder, listGolden, listOrders, listOrdersOfProjects, NO_TRACKING, OrdersUnreadable, trackingOf } from "./service";

const BRAND = "00000000-0000-4000-8000-0000000000b1";
const ORDER = "3f9a21c0-1111-4000-8000-000000000001";
const PROJECT = "00000000-0000-4000-8000-0000000000a1";
const RELEASE = "00000000-0000-4000-8000-0000000000e1";

const row = (over: Record<string, unknown> = {}) => ({
  id: ORDER,
  release_id: RELEASE,
  project_id: PROJECT,
  article_id: "JSY-SS-01",
  fabric_key: "F-POLY-INT",
  sizes: { M: 2 },
  pieces: 2,
  value_minor: null,
  currency: null,
  release_snapshot: { label: "Round 1", number: 1 },
  status: "ready",
  promised_on: "2026-12-04",
  created_at: "2026-11-02T10:00:00Z",
  ...over,
});

const answers = (over: Record<string, unknown> = {}) => ({
  ops_orders: { data: [row()] },
  projects: { data: [{ id: PROJECT, name: "Home shirt" }] },
  brand_runs: { data: [{ order_id: ORDER, kind: "sample" }] },
  customer_order_milestones: { data: [{ order_id: ORDER, qc_passed_at: "2026-11-05T10:00:00Z", shipped_on: null }] },
  ...over,
});

describe("the brand's orders", () => {
  it("joins the design's name, the run's kind and the milestones", async () => {
    const { client, calls } = fakeClient(answers());
    const [order] = await listOrders(client, BRAND);
    expect(order).toMatchObject({ number: "KW-3F9A21C0", productName: "Home shirt", kind: "sample", status: "qc_passed", readyOn: "2026-12-04", value: null });
    expect(calls.find((c) => c.name === "ops_orders")!.steps).toContainEqual(["eq", ["brand_id", BRAND]]);
  });

  it("keeps an order readable when its joins fail, at its ops state", async () => {
    const failed = { error: { message: "no" } };
    const { client } = fakeClient(answers({ projects: failed, brand_runs: failed, customer_order_milestones: failed, ops_orders: { data: [row({ value_minor: 4600, currency: "GBP" })] } }));
    const [order] = await listOrders(client, BRAND);
    expect(order).toMatchObject({ productName: "Round 1", kind: "order", status: "awaiting_qc", value: { minor: 4600, currency: "GBP" } });
  });

  it("is empty with no orders, and says so when the read fails", async () => {
    expect(await listOrders(fakeClient(answers({ ops_orders: { data: [] } })).client, BRAND)).toEqual([]);
    await expect(listOrders(fakeClient(answers({ ops_orders: { error: { message: "down" } } })).client, BRAND)).rejects.toBeInstanceOf(OrdersUnreadable);
    await expect(listOrders(fakeClient(answers({ ops_orders: { data: [{ id: "x" }] } })).client, BRAND)).rejects.toBeInstanceOf(OrdersUnreadable);
  });
});

describe("the orders of some designs (the canvas's Order boards)", () => {
  it("reads only the designs asked for, joined like the list, and nothing for none", async () => {
    const { client, calls } = fakeClient(answers());
    const [order] = await listOrdersOfProjects(client, BRAND, [PROJECT]);
    expect(order).toMatchObject({ projectId: PROJECT, kind: "sample", status: "qc_passed" });
    expect(calls.find((c) => c.name === "ops_orders")!.steps).toContainEqual(["in", ["project_id", [PROJECT]]]);
    expect(await listOrdersOfProjects(client, BRAND, [])).toEqual([]);
  });

  it("says so when the read fails or a row is not an order", async () => {
    await expect(listOrdersOfProjects(fakeClient(answers({ ops_orders: { error: { message: "down" } } })).client, BRAND, [PROJECT])).rejects.toBeInstanceOf(OrdersUnreadable);
    await expect(listOrdersOfProjects(fakeClient(answers({ ops_orders: { data: [{ id: "x" }] } })).client, BRAND, [PROJECT])).rejects.toBeInstanceOf(OrdersUnreadable);
  });
});

describe("one order", () => {
  it("reads one order of the brand, and none for an id that is not one", async () => {
    const { client } = fakeClient(answers({ ops_orders: { data: row({ release_snapshot: {} }) } }));
    expect(await getOrder(client, BRAND, ORDER)).toMatchObject({ id: ORDER, release: { label: "", number: 0 } });
    expect(await getOrder(client, BRAND, "not-an-id")).toBeNull();
    expect(await getOrder(fakeClient(answers({ ops_orders: { data: null } })).client, BRAND, ORDER)).toBeNull();
    await expect(getOrder(fakeClient(answers({ ops_orders: { data: { id: ORDER } } })).client, BRAND, ORDER)).rejects.toBeInstanceOf(OrdersUnreadable);
  });

  it("reads the parcels and the shared photos", async () => {
    const tracking = {
      shipments: [{ courier: "DHL", tracking_number: "T1", tracking_url: null, shipped_on: "2026-11-06", pieces: 2 }],
      inspections: [{ at: "2026-11-05T10:00:00Z", photo_file_ids: ["p1"] }],
    };
    const { client } = fakeClient({ customer_order_tracking: { data: tracking } });
    expect(await trackingOf(client, ORDER)).toEqual({ parcels: [{ courier: "DHL", trackingNumber: "T1", trackingUrl: null, shippedOn: "2026-11-06", pieces: 2 }], photoFileIds: ["p1"] });
    expect(await trackingOf(fakeClient({ customer_order_tracking: { data: null } }).client, ORDER)).toBe(NO_TRACKING);
    await expect(trackingOf(fakeClient({ customer_order_tracking: { data: { shipments: 1 } } }).client, ORDER)).rejects.toBeInstanceOf(OrdersUnreadable);
  });
});

describe("golden samples", () => {
  it("reads the brand's golden samples", async () => {
    const golden = [{ id: ORDER, product_id: PROJECT, version: 2, state: "approved", approved_at: null, created_at: "2026-11-01T00:00:00Z" }];
    expect(await listGolden(fakeClient({ golden_samples: { data: golden } }).client, BRAND)).toEqual([{ id: ORDER, productId: PROJECT, version: 2, state: "approved", createdAt: "2026-11-01T00:00:00Z" }]);
    await expect(listGolden(fakeClient({ golden_samples: { data: [{}] } }).client, BRAND)).rejects.toBeInstanceOf(OrdersUnreadable);
  });
});

describe("failed reads", () => {
  it("says so for one order, the tracking and the golden samples", async () => {
    const down = { error: { message: "down" } };
    await expect(getOrder(fakeClient(answers({ ops_orders: down })).client, BRAND, ORDER)).rejects.toBeInstanceOf(OrdersUnreadable);
    await expect(trackingOf(fakeClient({ customer_order_tracking: down }).client, ORDER)).rejects.toBeInstanceOf(OrdersUnreadable);
    await expect(listGolden(fakeClient({ golden_samples: down }).client, BRAND)).rejects.toBeInstanceOf(OrdersUnreadable);
    expect(await listGolden(fakeClient({ golden_samples: { data: null } }).client, BRAND)).toEqual([]);
  });

  it("reads rows that carry no data as empty", async () => {
    const { client } = fakeClient(answers({ projects: { data: null }, brand_runs: { data: null }, customer_order_milestones: { data: null } }));
    expect((await listOrders(client, BRAND))[0]).toMatchObject({ kind: "order", productName: "Round 1" });
    expect(await listOrders(fakeClient(answers({ ops_orders: { data: null } })).client, BRAND)).toEqual([]);
  });
});
