import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import { createCollection, exportDrop, listCollections, listFreightRates, loadPlan, removeStyle, saveFrame, saveStyle, unitsOfPlan } from "./service";
import { ids, plan } from "./fixtures/plan";

/**
 * Decision 0085: the collection tables. Reads go through the client the caller passes; every write goes
 * through one of the migration's functions with the brand and the person from the session.
 */

const BRAND = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const who = { brandId: BRAND, userId: USER };

const styleRow = (over: Record<string, unknown> = {}) => ({
  id: ids.navy,
  frame_id: ids.core,
  product_id: ids.product,
  name: "Matchday jersey",
  status: "approved",
  colourway: "Navy",
  article_code: "JSY-SS-01",
  fabric_code: "F-POLY-INT",
  production_class: "A",
  wholesale_minor: 4200,
  rrp_minor: 8000,
  wholesale_split_bp: 6000,
  x: 0,
  y: 0,
  collection_style_sizes: [
    { size_label: "M", qty: 20 },
    { size_label: "S", qty: 10 },
  ],
  ...over,
});

const planRow = (over: Record<string, unknown> = {}) => ({
  id: ids.collection,
  name: "Spring drop",
  destination_country: "GB",
  currency: "GBP",
  notes: "",
  updated_at: "2026-11-20T10:00:00Z",
  collection_frames: [
    { id: ids.training, name: "Training", x: 400, y: 0 },
    { id: ids.core, name: "Core", x: 0, y: 0 },
  ],
  collection_styles: [styleRow()],
  ...over,
});

describe("loadPlan", () => {
  it("reads the plan with its frames in name order and its sizes in size-run order", async () => {
    const { client, calls } = fakeClient({
      collections: { data: planRow() },
      brand_products: { data: [{ id: ids.product, project_id: ids.project }] },
    });
    const one = await loadPlan(client, BRAND, ids.collection);
    expect(one).toMatchObject({ name: "Spring drop", destinationCountry: "GB", currency: "GBP" });
    expect(one!.frames.map((frame) => frame.name)).toEqual(["Core", "Training"]);
    expect(one!.styles[0]!.sizes).toEqual([
      { label: "S", qty: 10 },
      { label: "M", qty: 20 },
    ]);
    expect(one!.styles[0]!.projectId).toBe(ids.project);
    expect(calls[0]!.steps.map(([step]) => step)).toEqual(["select", "eq", "eq", "maybeSingle"]);
  });

  it("reads nothing for a plan that is not the brand's", async () => {
    expect(await loadPlan(fakeClient({ collections: { data: null } }).client, BRAND, ids.collection)).toBeNull();
  });

  it("leaves a style with no product without a design", async () => {
    const { client } = fakeClient({ collections: { data: planRow({ collection_styles: [styleRow({ product_id: null })] }) } });
    const one = await loadPlan(client, BRAND, ids.collection);
    expect(one!.styles[0]).toMatchObject({ productId: null, projectId: null });
  });

  it("fails in plain words when the read fails or the shape is not the one described", async () => {
    await expect(loadPlan(fakeClient({ collections: { error: { code: "XX000", message: "boom" } } }).client, BRAND, ids.collection)).rejects.toMatchObject({ code: "internal" });
    await expect(loadPlan(fakeClient({ collections: { data: { id: ids.collection } } }).client, BRAND, ids.collection)).rejects.toMatchObject({ code: "internal" });
    const broken = fakeClient({ collections: { data: planRow() }, brand_products: { data: [{ id: ids.product }] } });
    await expect(loadPlan(broken.client, BRAND, ids.collection)).rejects.toMatchObject({ code: "internal" });
    const unread = fakeClient({ collections: { data: planRow() }, brand_products: { error: { code: "XX000", message: "boom" } } });
    await expect(loadPlan(unread.client, BRAND, ids.collection)).rejects.toMatchObject({ code: "internal" });
  });
});

describe("listCollections", () => {
  it("counts the styles and the pieces of every plan", async () => {
    const { client, calls } = fakeClient({
      collections: { data: [{ id: ids.collection, name: "Spring drop", destination_country: "GB", currency: "GBP", updated_at: "2026-11-20T10:00:00Z", collection_styles: [{ id: ids.navy, collection_style_sizes: [{ size_label: "M", qty: 20 }] }] }] },
    });
    expect(await listCollections(client, BRAND)).toEqual([
      { id: ids.collection, name: "Spring drop", destinationCountry: "GB", currency: "GBP", styles: 1, units: 20, updatedAt: "2026-11-20T10:00:00Z" },
    ]);
    expect(calls[0]!.steps.map(([step]) => step)).toEqual(["select", "eq", "order", "limit"]);
  });

  it("reads an empty list for a brand with no plans, and fails plainly on a bad shape", async () => {
    expect(await listCollections(fakeClient({}).client, BRAND)).toEqual([]);
    await expect(listCollections(fakeClient({ collections: { data: [{ id: 1 }] } }).client, BRAND)).rejects.toMatchObject({ code: "internal" });
    await expect(listCollections(fakeClient({ collections: { error: { code: "XX000", message: "boom" } } }).client, BRAND)).rejects.toMatchObject({ code: "internal" });
  });

  it("counts a plan's pieces from its styles' size rows", () => {
    expect(unitsOfPlan(plan())).toBe(45);
  });
});

describe("listFreightRates", () => {
  it("reads the freight rows with their labels and rule ids", async () => {
    const { client } = fakeClient({
      collection_freight_rates: { data: [{ country: "GB", per_piece_minor: 120, currency: "GBP", duty_basis: "goods_and_freight", rule_id: "R-GAP-000", label: "Placeholder freight, not a carrier quote" }] },
    });
    expect(await listFreightRates(client)).toEqual([
      { country: "GB", perPieceMinor: 120, currency: "GBP", dutyBasis: "goods_and_freight", ruleId: "R-GAP-000", label: "Placeholder freight, not a carrier quote" },
    ]);
  });

  it("fails plainly when the rows are not the shape described", async () => {
    await expect(listFreightRates(fakeClient({ collection_freight_rates: { data: [{ country: "GB" }] } }).client)).rejects.toMatchObject({ code: "internal" });
    await expect(listFreightRates(fakeClient({ collection_freight_rates: { error: { code: "XX000", message: "boom" } } }).client)).rejects.toMatchObject({ code: "internal" });
  });
});

describe("the writes", () => {
  it("sends the brand and the person from the session to every function", async () => {
    const { client, calls } = fakeClient({
      create_collection: { data: ids.collection },
      save_collection_frame: { data: ids.core },
      save_collection_style: { data: ids.navy },
      remove_collection_style: { data: null },
      export_collection_drop: { data: [{ id: ids.collection, version: 2 }] },
    });
    await createCollection(client, who, { name: "Spring drop", destinationCountry: "GB", currency: "GBP" });
    await saveFrame(client, who, { collectionId: ids.collection, frameId: null, name: "Core", x: 0, y: 0 });
    await saveStyle(client, who, {
      collectionId: ids.collection, styleId: null, frameId: ids.core, productId: null, name: "Matchday jersey", status: "draft",
      colourway: "Navy", articleCode: "JSY-SS-01", fabricCode: null, productionClass: null, wholesaleMinor: null, rrpMinor: null,
      wholesaleSplitBp: 0, sizes: { M: 10 }, x: 0, y: 0,
    });
    await removeStyle(client, who, ids.navy);
    expect(await exportDrop(client, who, ids.collection, { kind: "collection-drop" })).toEqual({ id: ids.collection, version: 2 });

    expect(calls.map((call) => call.name)).toEqual([
      "create_collection",
      "save_collection_frame",
      "save_collection_style",
      "remove_collection_style",
      "export_collection_drop",
    ]);
    for (const call of calls) expect(call.steps[0]![1][0]).toMatchObject({ p_brand_id: BRAND, p_user_id: USER });
  });

  it("passes the planned sizes on as pieces per size", async () => {
    const { client, calls } = fakeClient({ save_collection_style: { data: ids.navy } });
    await saveStyle(client, who, {
      collectionId: ids.collection, styleId: ids.navy, frameId: null, productId: null, name: "Jersey", status: "approved",
      colourway: "", articleCode: null, fabricCode: null, productionClass: null, wholesaleMinor: null, rrpMinor: null,
      wholesaleSplitBp: 6000, sizes: { S: 1, M: 2 }, x: 10, y: 20,
    });
    expect(calls[0]!.steps[0]![1][0]).toMatchObject({ p_sizes: { S: 1, M: 2 }, p_wholesale_split_bp: 6000, p_x: 10, p_y: 20 });
  });

  it("gives the database's own refusal, in its own words", async () => {
    const refused = (code: string, message: string) => fakeClient({ create_collection: { error: { code, message } } }).client;
    await expect(createCollection(refused("42501", "You may not plan a collection for this brand."), who, { name: "A", destinationCountry: "GB", currency: "GBP" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(createCollection(refused("P0001", "Knitwright does not deliver to that country yet."), who, { name: "A", destinationCountry: "ZZ", currency: "GBP" })).rejects.toMatchObject({
      code: "conflict",
      message: "Knitwright does not deliver to that country yet.",
    });
    await expect(saveFrame(fakeClient({ save_collection_frame: { error: { code: "P0002", message: "That collection does not exist." } } }).client, who, { collectionId: ids.collection, frameId: null, name: "Core", x: 0, y: 0 })).rejects.toMatchObject({ code: "not_found" });
    await expect(removeStyle(fakeClient({ remove_collection_style: { error: { code: "42501", message: "No." } } }).client, who, ids.navy)).rejects.toMatchObject({ code: "forbidden" });
    await expect(exportDrop(fakeClient({ export_collection_drop: { error: { code: "P0001", message: "A drop needs at least one style in the plan." } } }).client, who, ids.collection, {})).rejects.toMatchObject({ code: "conflict" });
  });
});
