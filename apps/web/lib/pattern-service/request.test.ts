import { describe, expect, it, vi } from "vitest";
import type { BlockView } from "@/lib/pattern-library/records";
import { requestPattern, type RequestDeps } from "./request";
import { snapshotHash, buildSnapshot } from "./snapshot";

const who = { brandId: "b", userId: "u" };
const design = { name: "Home shorts", garmentType: "shorts", currentVersion: 3, spec: { colour: "red" } };

const make = (over: Partial<RequestDeps> = {}) => {
  const create = vi.fn().mockResolvedValue({ requestId: "r1", created: true, charged: false, balance: 10 });
  const log = vi.fn();
  const ensureAllowance = vi.fn().mockResolvedValue(undefined);
  const deps: RequestDeps = {
    design: async () => design,
    blocks: async () => [],
    quote: async () => ({ priceCredits: null, turnaroundWorkingDays: null }),
    creditsEnforced: () => false,
    ensureAllowance,
    create,
    log,
    ...over,
  };
  return { deps, create, log, ensureAllowance };
};

describe("requestPattern", () => {
  it("sends the current version with the hash of the design and copies the quote", async () => {
    const { deps, create } = make({ quote: async () => ({ priceCredits: null, turnaroundWorkingDays: 5 }) });
    const out = await requestPattern(deps, who, "p1");
    const expected = snapshotHash(buildSnapshot({ projectId: "p1", version: 3, garmentType: "shorts", name: "Home shorts", spec: { colour: "red" } }));
    expect(out.snapshotHash).toBe(expected);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ designVersion: 3, articleId: "shorts", snapshotHash: expected, quote: { priceCredits: null, turnaroundWorkingDays: 5 }, charge: false }));
  });

  it("charges nothing and gives no allowance when no price is set", async () => {
    const { deps, create, ensureAllowance, log } = make({ creditsEnforced: () => true });
    await requestPattern(deps, who, "p1");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ charge: false }));
    expect(ensureAllowance).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("treats a price of 0 as free", async () => {
    const { deps, create } = make({ creditsEnforced: () => true, quote: async () => ({ priceCredits: 0, turnaroundWorkingDays: null }) });
    await requestPattern(deps, who, "p1");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ charge: false }));
  });

  it("charges a set price once the credits flag is on, after the month's allowance", async () => {
    const { deps, create, ensureAllowance } = make({ creditsEnforced: () => true, quote: async () => ({ priceCredits: 4, turnaroundWorkingDays: 5 }) });
    await requestPattern(deps, who, "p1");
    expect(ensureAllowance).toHaveBeenCalledWith("b");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ charge: true }));
  });

  it("only records what a price would have cost while the credits flag is off", async () => {
    const { deps, create, log } = make({ quote: async () => ({ priceCredits: 4, turnaroundWorkingDays: null }) });
    await requestPattern(deps, who, "p1");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ charge: false }));
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ level: "info", message: expect.stringContaining("would have cost 4 credits") }));
  });

  it("refuses a garment that already has a pattern block", async () => {
    const { deps, create } = make({ blocks: async () => [{ productKey: "shorts", kind: "pieces" } as BlockView] });
    await expect(requestPattern(deps, who, "p1")).rejects.toMatchObject({ code: "conflict" });
    expect(create).not.toHaveBeenCalled();
  });
});
