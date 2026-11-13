import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { describeRun, latestCutoff, nextCutoff, sendBatch, type BatchOutcome, type SendDeps } from "./batching";

const BATCH = { id: "b1", brandId: "brand", listingId: "l1", sizes: { M: 3 } };

const deps = (order: SendDeps["order"]) => {
  const settle = vi.fn(async () => undefined);
  const refundAll = vi.fn(async () => undefined);
  return { deps: { order, settle, refundAll }, settle, refundAll };
};

describe("the weekly cut-off: Monday 12:00 in Pakistan, 07:00 UTC", () => {
  it("finds the latest cut-off at or before now, and the next one", () => {
    expect(latestCutoff(new Date("2026-11-13T12:00:00Z")).toISOString()).toBe("2026-11-09T07:00:00.000Z"); // a Friday
    expect(latestCutoff(new Date("2026-11-16T07:00:00Z")).toISOString()).toBe("2026-11-16T07:00:00.000Z"); // the minute itself
    expect(latestCutoff(new Date("2026-11-16T06:59:00Z")).toISOString()).toBe("2026-11-09T07:00:00.000Z"); // a Monday morning
    expect(latestCutoff(new Date("2026-11-15T23:00:00Z")).toISOString()).toBe("2026-11-09T07:00:00.000Z"); // a Sunday
    expect(nextCutoff(new Date("2026-11-13T12:00:00Z")).toISOString()).toBe("2026-11-16T07:00:00.000Z");
  });
});

describe("sending a batch", () => {
  it("settles a batch production took, and refunds nobody", async () => {
    const sent: BatchOutcome = { status: "sent", orderId: "o1" };
    const { deps: d, settle, refundAll } = deps(async () => sent);
    await expect(sendBatch(d, BATCH)).resolves.toEqual(sent);
    expect(settle).toHaveBeenCalledWith("b1", sent);
    expect(refundAll).not.toHaveBeenCalled();
  });

  it("refunds every shopper when the door refuses the batch, before or after payment", async () => {
    const before = deps(async () => {
      throw new AppError("conflict", "This design has failing checks.");
    });
    await expect(sendBatch(before.deps, BATCH)).resolves.toEqual({ status: "refused", message: "This design has failing checks." });
    expect(before.refundAll).toHaveBeenCalledWith("b1", "Not sent to production: This design has failing checks.");

    const after = deps(async () => ({ status: "refused", message: "Not paid." }));
    await sendBatch(after.deps, BATCH);
    expect(after.settle).toHaveBeenCalledWith("b1", { status: "refused", message: "Not paid." });
    expect(after.refundAll).toHaveBeenCalledTimes(1);
  });

  it("leaves a batch open on a fault, so the next run tries again", async () => {
    for (const fault of [new Error("network"), new AppError("internal", "db"), new AppError("unavailable", "down")]) {
      const { deps: d, settle, refundAll } = deps(async () => {
        throw fault;
      });
      await expect(sendBatch(d, BATCH)).rejects.toBe(fault);
      expect(settle).not.toHaveBeenCalled();
      expect(refundAll).not.toHaveBeenCalled();
    }
  });

  it("describes a run in one line", () => {
    expect(describeRun({ closedDrops: 1, batches: 3, sent: 2, refused: 1, failed: 0 })).toBe("1 drops closed; 3 batches: 2 sent, 1 refused, 0 to retry.");
  });
});
