import { describe, expect, it } from "vitest";
import type { CollectionPlan, Style } from "@/lib/collections/types";
import { sampleDrop } from "./fixtures/samples";
import { countdown, currentDrop, dropCards, dropFromPlan, dropState, isOpen, newDropBody, progressLine, progressPercent, saleNote, windowLine } from "./drops";

const at = (iso: string) => new Date(iso);
const DROP = sampleDrop(); // 10 Nov 10:00 – 20 Nov 10:00 UTC

const style = (over: Partial<Style>): Style => ({
  id: "s", frameId: null, productId: null, projectId: null, name: "Home", status: "approved", colourway: "Navy", articleCode: "JSY-SS-01", fabricCode: null,
  productionClass: "A", wholesaleMinor: null, rrpMinor: 4500, wholesaleSplitBp: 0, sizes: [{ label: "M", qty: 10 }, { label: "L", qty: 5 }], x: 0, y: 0, ...over,
});

const plan = (styles: readonly Style[]): CollectionPlan => ({ id: "p", name: "2027", destinationCountry: "GB", currency: "GBP", notes: "", frames: [], styles, updatedAt: "" });

describe("drop windows", () => {
  it("is upcoming, open, closing, closed or cancelled", () => {
    expect(dropState(DROP, at("2026-11-09T00:00:00Z"))).toBe("upcoming");
    expect(dropState(DROP, at("2026-11-13T00:00:00Z"))).toBe("open");
    expect(isOpen(DROP, at("2026-11-13T00:00:00Z"))).toBe(true);
    expect(dropState(DROP, at("2026-11-20T10:00:00Z"))).toBe("closing");
    expect(dropState({ ...DROP, status: "closed" }, at("2026-11-13T00:00:00Z"))).toBe("closed");
    expect(dropState({ ...DROP, status: "cancelled" }, at("2026-11-13T00:00:00Z"))).toBe("cancelled");
  });

  it("counts down in days, hours or minutes", () => {
    expect(countdown(DROP, at("2026-11-13T10:00:00Z"))).toBe("Closes in 7 days");
    expect(countdown(DROP, at("2026-11-20T05:00:00Z"))).toBe("Closes in 5 hours");
    expect(countdown(DROP, at("2026-11-20T09:59:30Z"))).toBe("Closes in 1 minute");
    expect(countdown(DROP, at("2026-11-09T10:00:00Z"))).toBe("Opens in 1 day");
    expect(countdown(DROP, at("2026-11-21T00:00:00Z"))).toBe("Closed, batching");
  });

  it("reports progress against the target", () => {
    expect(progressLine(18, 30)).toBe("18 of 30 pre-orders");
    expect(progressLine(1, null)).toBe("1 pre-order");
    expect(progressPercent(18, 30)).toBe(60);
    expect(progressPercent(40, 30)).toBe(100);
    expect(progressPercent(1, null)).toBeNull();
    expect(windowLine(DROP)).toBe("10 Nov, 10:00 – 20 Nov, 10:00 UTC");
  });

  it("builds the drop cards", () => {
    const cards = dropCards([DROP, { ...DROP, id: "d2", opensAt: "2026-12-01T00:00:00Z", closesAt: "2026-12-02T00:00:00Z", targetUnits: null }], new Map([[DROP.id, 12]]), at("2026-11-13T10:00:00Z"));
    expect(cards[0]).toMatchObject({ state: "Open", progress: "12 of 30 pre-orders", percent: 40, cancellable: false });
    expect(cards[1]).toMatchObject({ state: "Opens soon", progress: "0 pre-orders", percent: null, cancellable: true });
  });

  it("makes a drop from a plan: its styles' listings, planned pieces as targets, and says what is left out", () => {
    const made = dropFromPlan(
      plan([style({ id: "a", productId: "p1" }), style({ id: "b", productId: "p1", sizes: [{ label: "S", qty: 5 }] }), style({ id: "c", name: "Away", productId: "p2" }), style({ id: "d", name: "Training", productId: null }), style({ id: "e", productId: "p3", sizes: [] })]),
      new Map([["p1", "l1"], ["p3", "l3"]]),
    );
    expect(made.listings).toEqual([{ listingId: "l1", targetUnits: 20 }, { listingId: "l3", targetUnits: null }]);
    expect(made.left).toEqual([{ style: "Away", reason: "has no listing yet" }, { style: "Training", reason: "has no product yet" }]);
    expect(made.targetUnits).toBe(20);
    expect(dropFromPlan(plan([]), new Map()).targetUnits).toBeNull();
  });

  it("checks a new drop's window", () => {
    const body = { collectionId: "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b", name: "Drop", opensAt: "2026-11-20T10:00:00.000Z", closesAt: "2026-11-27T10:00:00.000Z" };
    expect(newDropBody.safeParse(body).success).toBe(true);
    expect(newDropBody.safeParse({ ...body, closesAt: body.opensAt }).success).toBe(false);
    expect(newDropBody.safeParse({ ...body, closesAt: "2027-06-01T10:00:00.000Z" }).success).toBe(false);
  });

  it("says what the storefront shows under a product, or hides it until its drop is open", () => {
    const now = at("2026-11-13T10:00:00Z");
    const later = { ...DROP, id: "later", opensAt: "2026-12-01T00:00:00Z", closesAt: "2026-12-05T00:00:00Z" };
    expect(saleNote({ mode: "made_to_order", hideUntilReady: true }, [], now)).toBe("Made to order");
    expect(saleNote({ mode: "drop", hideUntilReady: false }, [DROP], now)).toBe("Pre-order · Closes in 7 days");
    expect(saleNote({ mode: "drop", hideUntilReady: true }, [later], now)).toBeNull();
    expect(saleNote({ mode: "drop", hideUntilReady: false }, [later], now)).toBe("Opens in 17 days");
    expect(saleNote({ mode: "drop", hideUntilReady: true }, [], now)).toBeNull();
    expect(saleNote({ mode: "drop", hideUntilReady: false }, [], now)).toBe("Not on sale yet");
    expect(currentDrop([later, DROP], now)?.id).toBe(DROP.id);
  });
});
