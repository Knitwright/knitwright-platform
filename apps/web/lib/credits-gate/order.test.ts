import { describe, expect, it, vi } from "vitest";
import { designVersionHash } from "@/lib/credits/version-hash";
import { orderVersion } from "./order";

const WHO = { brandId: "b1", userId: "u1" } as const;

describe("orderVersion", () => {
  it("moves the version to ordered, then refunds every spend on it", async () => {
    const calls: string[] = [];
    const refund = vi.fn(async () => (calls.push("refund"), { refunded: 2, balance: 9 }));
    const result = await orderVersion(
      { writeOrdered: async () => void calls.push("status"), refundForOrder: refund, log: () => {} },
      WHO, "p1", 4,
    );
    expect(calls).toEqual(["status", "refund"]);
    expect(result).toEqual({ refunded: 2 });
    expect(refund).toHaveBeenCalledWith({ brandId: "b1", designVersionHash: designVersionHash("p1", 4) });
  });

  it("does not refund when the status move is refused", async () => {
    const refund = vi.fn();
    await expect(
      orderVersion({ writeOrdered: async () => { throw new Error("draft"); }, refundForOrder: refund, log: () => {} }, WHO, "p1", 1),
    ).rejects.toThrow("draft");
    expect(refund).not.toHaveBeenCalled();
  });

  it("keeps the order when the refund fails, logs it, and says so", async () => {
    const logs: unknown[] = [];
    const result = await orderVersion(
      { writeOrdered: async () => {}, refundForOrder: async () => { throw new Error("db down"); }, log: (e) => logs.push(e) },
      WHO, "p1", 1,
    );
    expect(result).toEqual({ refunded: null });
    expect(logs).toHaveLength(1);
  });
});
