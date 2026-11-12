import { describe, expect, it } from "vitest";
import type { ProductView } from "@/lib/brand-runs/service";
import type { CollectionPlan, Style } from "@/lib/collections/types";
import type { CustomerOrder } from "./service";
import { filterOrders, orderBasket, planBasket, sampleEntries } from "./views";

const order = (over: Partial<CustomerOrder> = {}): CustomerOrder => ({
  id: "o1",
  number: "KW-AAAA0001",
  releaseId: "r1",
  projectId: "p1",
  productName: "Home shirt",
  kind: "run",
  articleId: "JSY-SS-01",
  fabricKey: "F-POLY-INT",
  sizes: { M: 2 },
  pieces: 25,
  value: null,
  opsStatus: "batched",
  status: "in_batch",
  milestones: { qcPassedAt: null, shippedOn: null },
  release: { label: "Round 1", number: 1 },
  readyOn: null,
  createdAt: "2026-11-02T00:00:00Z",
  ...over,
});

describe("filtering the orders", () => {
  it("keeps the chip's orders that match the search", () => {
    const orders = [order(), order({ id: "o2", number: "KW-BBBB0002", productName: "Away shorts", status: "shipped" })];
    expect(filterOrders(orders, "all", "", "Lions").map((o) => o.id)).toEqual(["o1", "o2"]);
    expect(filterOrders(orders, "shipped", "", "Lions").map((o) => o.id)).toEqual(["o2"]);
    expect(filterOrders(orders, "all", "away", "Lions").map((o) => o.id)).toEqual(["o2"]);
    expect(filterOrders(orders, "all", "bbbb", "Lions").map((o) => o.id)).toEqual(["o2"]);
    expect(filterOrders(orders, "all", "lions", "Lions")).toHaveLength(2);
    expect(filterOrders(orders, "cancelled", "", "Lions")).toEqual([]);
  });
});

const product = (runs: ProductView["runs"]): ProductView => ({ id: "prod1", projectId: "p1", name: "Home shirt", stage: "sample", designVersion: 1, createdAt: "2026-10-01T00:00:00Z", runs });
const run = (over: Partial<ProductView["runs"][number]>): ProductView["runs"][number] => ({ id: "run1", kind: "sample", releaseId: "r1", pieces: 2, sizes: { M: 1, L: 1 }, flags: [], createdAt: "2026-11-01T00:00:00Z", order: null, ...over });

describe("the samples tab", () => {
  it("lists samples with where their order is, and golden samples with their state, newest first", () => {
    const entries = sampleEntries(
      [product([run({}), run({ id: "run2", order: { status: "received", promisedOn: null, cutoffAt: "" }, createdAt: "2026-11-03T00:00:00Z" }), run({ id: "run3", kind: "run" }), run({ id: "run4", order: { status: "odd", promisedOn: null, cutoffAt: "" } })])],
      [
        { id: "g1", productId: "prod1", version: 2, state: "approved", createdAt: "2026-11-04T00:00:00Z" },
        { id: "g2", productId: "gone", version: 1, state: "draft", createdAt: "2026-11-05T00:00:00Z" },
      ],
    );
    expect(entries.map((e) => [e.id, e.status])).toEqual([
      ["g1", "Signed off by the founder"],
      ["run2", "At factory"],
      ["run1", "Sent to production"],
      ["run4", "Sent to production"],
    ]);
    expect(entries[0]).toMatchObject({ kind: "golden", detail: "Version 2", href: "/studio/p1/make/golden-sample" });
    expect(entries[2]).toMatchObject({ detail: "M1 · L1", href: "/studio/p1/make/sample" });
  });
});

const style = (over: Partial<Style>): Style => ({
  id: "s1", frameId: null, productId: null, projectId: null, name: "Jersey", status: "draft", colourway: "Navy", articleCode: "JSY-SS-01", fabricCode: null,
  productionClass: "A", wholesaleMinor: null, rrpMinor: null, wholesaleSplitBp: 6000, sizes: [{ label: "M", qty: 10 }], x: 0, y: 0, ...over,
});

describe("the quotes tab", () => {
  it("sums a plan's styles per article and names the ones it cannot price", () => {
    const plan: CollectionPlan = { id: "c1", name: "Spring drop", destinationCountry: "GB", currency: "GBP", notes: "", frames: [], updatedAt: "", styles: [style({}), style({ id: "s2", sizes: [{ label: "L", qty: 5 }] }), style({ id: "s3", name: "Hoodie", articleCode: null })] };
    expect(planBasket(plan)).toMatchObject({ title: "Spring drop", lines: [{ articleCode: "JSY-SS-01", qty: 15 }], unpriced: ["Hoodie"], pieces: 15, currency: "GBP" });
  });

  it("quotes an order of a catalogue article again, and not one of an article the catalogue does not code", () => {
    expect(orderBasket(order(), "GBP")).toMatchObject({ lines: [{ articleCode: "JSY-SS-01", qty: 25 }], title: "KW-AAAA0001 · Home shirt" });
    expect(orderBasket(order({ articleId: "crew-tee" }), "GBP")).toBeNull();
  });
});
