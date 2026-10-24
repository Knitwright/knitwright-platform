import { describe, expect, it } from "vitest";
import { fulfilmentOf, overShipped, remainingSizes, shipBlocker, shippedSizes, sumSizes } from "./rules";
import { manualProvider } from "./provider";

const parcel = (sizes: Record<string, number>) => ({ sizes, pieces: sumSizes(sizes) });

describe("what is shipped", () => {
  it("adds parcels up by size and says what is still owed", () => {
    const sent = [parcel({ M: 2 }), parcel({ M: 1, L: 1 })];
    expect(shippedSizes(sent)).toEqual({ M: 3, L: 1 });
    expect(remainingSizes({ M: 3, L: 2, XL: 1 }, sent)).toEqual({ L: 1, XL: 1 });
  });

  it("is not shipped, part shipped, then shipped", () => {
    const order = { pieces: 5 };
    expect(fulfilmentOf(order, [])).toBe("not_shipped");
    expect(fulfilmentOf(order, [parcel({ M: 3 })])).toBe("part_shipped");
    expect(fulfilmentOf(order, [parcel({ M: 3 }), parcel({ L: 2 })])).toBe("shipped");
  });
});

describe("shipBlocker", () => {
  const ok = { status: "ready" as const, latestQc: "pass" as const, fulfilment: "not_shipped" as const };
  it("lets a ready order with a passing inspection ship, including the rest of a part shipped one", () => {
    expect(shipBlocker(ok)).toBeNull();
    expect(shipBlocker({ ...ok, fulfilment: "part_shipped" })).toBeNull();
  });
  it("blocks a failing or missing inspection", () => {
    expect(shipBlocker({ ...ok, latestQc: "fail" })).toMatch(/failed/);
    expect(shipBlocker({ ...ok, latestQc: null })).toMatch(/not been inspected/);
  });
  it("blocks an order the factory has not marked ready, and one already shipped", () => {
    for (const status of ["submitted", "batched", "held", "received", "in_production"] as const) expect(shipBlocker({ ...ok, status })).toMatch(/marked ready/);
    expect(shipBlocker({ ...ok, fulfilment: "shipped" })).toMatch(/Every piece/);
  });
});

describe("overShipped", () => {
  it("names each size that goes over", () => {
    expect(overShipped({ M: 1 }, { M: 1 })).toEqual([]);
    expect(overShipped({ M: 1 }, { M: 2, L: 1 })).toEqual(["Size M: 2 in the parcel, 1 still owed.", "Size L: 1 in the parcel, 0 still owed."]);
  });
});

describe("the manual provider", () => {
  it("hands back what was typed, trimmed, with no link it did not get", async () => {
    expect(await manualProvider.prepare({ courier: " DHL ", trackingNumber: " 123 " })).toEqual({ provider: "manual", courier: "DHL", trackingNumber: "123", trackingUrl: null });
  });
});
