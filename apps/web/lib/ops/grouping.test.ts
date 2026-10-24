import { describe, expect, it } from "vitest";
import { groupOrdersForCutoff, summariseOrders, type GroupableOrder } from "./grouping";

const order = (over: Partial<GroupableOrder> & { id: string }): GroupableOrder => ({
  factoryProfileId: "f1",
  fabricKey: "mesh",
  articleId: "team-jersey",
  cutoffAt: "2026-10-23T17:00:00.000Z",
  status: "submitted",
  pieces: 2,
  sizes: { M: 1, L: 1 },
  valueMinor: 1000,
  currency: "AUD",
  ...over,
});
const NOW = new Date("2026-10-23T17:00:00Z");

describe("groupOrdersForCutoff", () => {
  it("groups by factory, fabric, article and cut-off", () => {
    const groups = groupOrdersForCutoff(
      [order({ id: "a" }), order({ id: "b" }), order({ id: "c", fabricKey: "cotton" }), order({ id: "d", articleId: "shorts" }), order({ id: "e", factoryProfileId: "f2" })],
      NOW,
    );
    expect(groups).toHaveLength(4);
    expect(groups.find((g) => g.fabricKey === "mesh" && g.articleId === "team-jersey" && g.factoryProfileId === "f1")?.orderIds).toEqual(["a", "b"]);
  });

  it("leaves out orders whose cut-off is still ahead, held, or already batched", () => {
    const groups = groupOrdersForCutoff(
      [
        order({ id: "later", cutoffAt: "2026-10-30T17:00:00.000Z" }),
        order({ id: "held", status: "held" }),
        order({ id: "done", status: "batched" }),
        order({ id: "ok" }),
      ],
      NOW,
    );
    expect(groups.flatMap((g) => g.orderIds)).toEqual(["ok"]);
  });

  it("is the same whatever order the orders arrive in", () => {
    const orders = [order({ id: "a" }), order({ id: "b", fabricKey: "x" }), order({ id: "c", cutoffAt: "2026-10-16T17:00:00.000Z" })];
    expect(groupOrdersForCutoff([...orders].reverse(), NOW)).toEqual(groupOrdersForCutoff(orders, NOW));
  });

  it("does not change what it is given", () => {
    const orders = Object.freeze([Object.freeze(order({ id: "a" }))]);
    expect(() => groupOrdersForCutoff(orders, NOW)).not.toThrow();
  });
});

describe("summariseOrders", () => {
  it("adds pieces, sizes and value", () => {
    const s = summariseOrders([order({ id: "a" }), order({ id: "b", sizes: { M: 3 }, pieces: 3, valueMinor: 500 })]);
    expect(s.pieces).toBe(5);
    expect(s.sizes).toEqual({ L: 1, M: 4 });
    expect(s.value).toEqual({ minor: 1500, currency: "AUD" });
  });

  it("gives no value when any order has none or the currencies differ, rather than a partial sum", () => {
    expect(summariseOrders([order({ id: "a" }), order({ id: "b", valueMinor: null, currency: null })]).value).toBeNull();
    expect(summariseOrders([order({ id: "a" }), order({ id: "b", currency: "EUR" })]).value).toBeNull();
    expect(summariseOrders([]).value).toBeNull();
  });
});
