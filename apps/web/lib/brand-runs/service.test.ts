import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import { confirmStage, createProduct, getProduct, listProducts, submitRun } from "./service";

const BRAND = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const P1 = "33333333-3333-4333-8333-333333333333";
const PROJECT = "44444444-4444-4444-8444-444444444444";
const RUN_A = "55555555-5555-4555-8555-555555555551";
const RUN_B = "55555555-5555-4555-8555-555555555552";
const ORDER_A = "66666666-6666-4666-8666-666666666661";
const ORDER_B = "66666666-6666-4666-8666-666666666662";
const REL = "77777777-7777-4777-8777-777777777777";
const who = { brandId: BRAND, userId: USER };
const run = (id: string, order: string, at: string, kind = "sample") => ({ id, kind, release_id: REL, pieces: 2, sizes: { S: 1, M: 1 }, flags: [], order_id: order, created_at: at });
const product = { id: P1, project_id: PROJECT, name: "Hoodie", stage: "idea", design_version: 3, created_at: "2026-10-25T00:00:00Z", brand_runs: [run(RUN_A, ORDER_A, "2026-10-25T01:00:00Z"), run(RUN_B, ORDER_B, "2026-10-26T01:00:00Z", "run")] };

describe("listProducts", () => {
  it("lists products with their newest run first and the ops status of each order", async () => {
    const { client } = fakeClient({
      brand_products: { data: [product] },
      ops_orders: { data: [{ id: ORDER_A, status: "submitted", promised_on: null, cutoff_at: "2026-10-30T17:00:00Z" }] },
    });
    const [listed] = await listProducts(client, BRAND);
    expect(listed).toMatchObject({ name: "Hoodie", stage: "idea", designVersion: 3 });
    expect(listed!.runs.map((r) => r.id)).toEqual([RUN_B, RUN_A]);
    expect(listed!.runs[1]!.order).toEqual({ status: "submitted", promisedOn: null, cutoffAt: "2026-10-30T17:00:00Z" });
    expect(listed!.runs[0]!.order).toBeNull();
  });
  it("lists nothing, and asks ops about nothing, when there are no products", async () => {
    const { client, calls } = fakeClient({});
    expect(await listProducts(client, BRAND)).toEqual([]);
    expect(calls.map((c) => c.name)).toEqual(["brand_products"]);
  });
  it("still lists products when the order status cannot be read", async () => {
    const { client } = fakeClient({ brand_products: { data: [product] }, ops_orders: { error: { code: "42501", message: "no" } } });
    expect((await listProducts(client, BRAND))[0]!.runs.every((r) => r.order === null)).toBe(true);
  });
  it("fails in plain words when the list cannot be read", async () => {
    const { client } = fakeClient({ brand_products: { error: { code: "XX000", message: "boom" } } });
    await expect(listProducts(client, BRAND)).rejects.toMatchObject({ code: "internal" });
  });
});

describe("getProduct", () => {
  it("reads one product of the brand", async () => {
    const { client } = fakeClient({ brand_products: { data: { id: P1, project_id: PROJECT, stage: "sample" } } });
    expect(await getProduct(client, BRAND, P1)).toEqual({ id: P1, projectId: PROJECT, stage: "sample" });
  });
  it("says not found for a product that is not there or not the brand's", async () => {
    await expect(getProduct(fakeClient({}).client, BRAND, P1)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("writes", () => {
  it("lists a design as a product with the brand and person from the session", async () => {
    const { client, calls } = fakeClient({ create_brand_product: { data: P1 } });
    expect(await createProduct(client, who, { projectId: PROJECT, name: "Hoodie" })).toBe(P1);
    expect(calls[0]!.steps[0]![1][0]).toEqual({ p_brand_id: BRAND, p_user_id: USER, p_project_id: PROJECT, p_name: "Hoodie" });
  });
  it("answers a missing design in plain words", async () => {
    const { client } = fakeClient({ create_brand_product: { error: { code: "P0002", message: "x" } } });
    await expect(createProduct(client, who, { projectId: PROJECT, name: "A" })).rejects.toMatchObject({ code: "not_found", message: "That design does not exist." });
  });
  it("confirms a stage", async () => {
    const { client } = fakeClient({ confirm_brand_product_stage: { data: "sample" } });
    expect(await confirmStage(client, who, P1, "sample")).toBe("sample");
  });
  it("refuses a stage move the database refuses", async () => {
    const { client } = fakeClient({ confirm_brand_product_stage: { error: { code: "P0001", hint: "need_sample_order", message: "x" } } });
    await expect(confirmStage(client, who, P1, "sample")).rejects.toMatchObject({ code: "conflict" });
  });
  it("sends a run and reads the order back", async () => {
    const row = { run_id: RUN_A, order_id: ORDER_A, status: "submitted", cutoff_at: "2026-10-30T17:00:00Z", promised_on: null, created: true };
    const { client, calls } = fakeClient({ submit_brand_run: { data: [row] } });
    const sent = await submitRun(client, who, { productId: P1, kind: "sample", releaseId: REL, factoryProfileId: "f", fabricKey: "mesh", sizes: { S: 1 }, flags: [], requestKey: "abcdefgh" });
    expect(sent).toEqual({ runId: RUN_A, orderId: ORDER_A, status: "submitted", cutoffAt: "2026-10-30T17:00:00Z", promisedOn: null, created: true });
    expect(calls[0]!.steps[0]![1][0]).toMatchObject({ p_kind: "sample", p_sizes: { S: 1 }, p_request_key: "abcdefgh" });
  });
  it("fails when a release is not the product's", async () => {
    const { client } = fakeClient({ submit_brand_run: { error: { code: "P0002", hint: "release_not_found", message: "x" } } });
    await expect(submitRun(client, who, { productId: P1, kind: "run", releaseId: REL, factoryProfileId: "f", fabricKey: "m", sizes: { S: 1 }, flags: [], requestKey: "abcdefgh" })).rejects.toMatchObject({ code: "not_found" });
  });
});
