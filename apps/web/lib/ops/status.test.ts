import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, canDelay, canHold, canMove, canReleaseHold, nextStatus, checkDelay, isForwardStep } from "./status";

describe("order status", () => {
  it("moves one step forward: batched, received, in production, ready", () => {
    expect(nextStatus("batched")).toBe("received");
    expect(nextStatus("received")).toBe("in_production");
    expect(nextStatus("in_production")).toBe("ready");
  });

  it("has no step after ready, and none for an order not yet in a batch", () => {
    expect(nextStatus("ready")).toBeNull();
    expect(nextStatus("submitted")).toBeNull();
    expect(nextStatus("held")).toBeNull();
  });

  it("refuses to skip a step or go back", () => {
    expect(isForwardStep("batched", "in_production")).toBe(false);
    expect(isForwardStep("received", "batched")).toBe(false);
    expect(isForwardStep("received", "in_production")).toBe(true);
  });

  it("lets ops hold an order only before the factory has it", () => {
    expect(ORDER_STATUSES.filter(canHold)).toEqual(["submitted", "batched"]);
    expect(ORDER_STATUSES.filter(canReleaseHold)).toEqual(["held"]);
    expect(ORDER_STATUSES.filter(canMove)).toEqual(["submitted", "batched", "held"]);
    expect(ORDER_STATUSES.filter(canDelay)).toEqual(["batched", "received", "in_production"]);
  });
});

describe("checkDelay", () => {
  it("needs a reason", () => {
    expect(checkDelay({ current: "2026-11-13", next: "2026-11-20", reason: "  " })).toMatch(/reason/);
  });

  it("only pushes the date later", () => {
    expect(checkDelay({ current: "2026-11-13", next: "2026-11-13", reason: "Yarn late" })).toMatch(/later/);
    expect(checkDelay({ current: "2026-11-13", next: "2026-11-12", reason: "Yarn late" })).toMatch(/later/);
    expect(checkDelay({ current: "2026-11-13", next: "2026-11-20", reason: "Yarn late" })).toBeNull();
  });

  it("accepts any real date when none was promised", () => {
    expect(checkDelay({ current: null, next: "2026-11-20", reason: "Yarn late" })).toBeNull();
    expect(checkDelay({ current: null, next: "2026-13-40", reason: "Yarn late" })).toMatch(/date/);
  });
});
