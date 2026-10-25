import { describe, expect, it, vi } from "vitest";
import type { UsageMeter } from "@/lib/usage/meter";
import { DEFAULT_DAILY_CAP_MICRODOLLARS, LIFESTYLE_ROUTE_PREFIX, spentTodayBy, usageBudget } from "./budget";

const meter = (refuse = false): UsageMeter & { reserve: ReturnType<typeof vi.fn>; refund: ReturnType<typeof vi.fn> } => ({
  reserve: vi.fn(async () => (refuse ? { ok: false as const, refused: "brand" as const } : { ok: true as const, eventId: "evt-1" })),
  refund: vi.fn(async () => true),
});

const budget = (usage: UsageMeter, spent = 0, cap?: number) =>
  usageBudget({ usage, brandId: "b", userId: "u", spentToday: async () => spent, dailyCapMicrodollars: cap });

describe("usageBudget", () => {
  it("reserves the cost as photoreal spend under a route that names the provider", async () => {
    const usage = meter();
    const spend = await budget(usage).take("fal", 80_000);
    expect(spend.ok).toBe(true);
    expect(usage.reserve).toHaveBeenCalledWith({ userId: "u", brandId: "b", cost: { feature: "photoreal", microdollars: 80_000 }, route: `${LIFESTYLE_ROUTE_PREFIX}fal` });
  });

  it("gives the cost back on refund", async () => {
    const usage = meter();
    const spend = await budget(usage).take("fal", 80_000);
    if (spend.ok) await spend.refund();
    expect(usage.refund).toHaveBeenCalledWith("evt-1");
  });

  it("refuses at the daily cap without calling the meter", async () => {
    const usage = meter();
    expect(await budget(usage, 4_950_000).take("fal", 80_000)).toEqual({ ok: false, reason: "daily_cap" });
    expect(usage.reserve).not.toHaveBeenCalled();
  });

  it("counts calls made together, so parallel scenes cannot all take the last place", async () => {
    const usage = meter();
    const b = budget(usage, 0, 200_000);
    const results = await Promise.all([b.take("fal", 80_000), b.take("fal", 80_000), b.take("fal", 80_000)]);
    expect(results.filter((r) => r.ok)).toHaveLength(2);
  });

  it("frees the place when the meter refuses or a spend is given back", async () => {
    const b = budget(meter(true), 0, 100_000);
    expect(await b.take("fal", 80_000)).toEqual({ ok: false, reason: "allowance" });
    const c = budget(meter(), 0, 100_000);
    const first = await c.take("fal", 80_000);
    if (first.ok) await first.refund();
    expect((await c.take("fal", 80_000)).ok).toBe(true);
  });

  it("lets a free provider through without touching the meter", async () => {
    const usage = meter();
    expect((await budget(usage).take("stub", 0)).ok).toBe(true);
    expect(usage.reserve).not.toHaveBeenCalled();
  });

  it("has a labelled default cap", () => {
    expect(DEFAULT_DAILY_CAP_MICRODOLLARS).toBe(5_000_000);
  });
});

const fakeClient = (result: { data: unknown; error: unknown }) => {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain: Record<string, unknown> = {};
  for (const name of ["select", "eq", "like", "is"]) chain[name] = (...args: unknown[]) => (calls.push([name, ...args]), name === "is" ? Promise.resolve(result) : chain);
  return { client: { from: (table: string) => (calls.push(["from", table]), chain) } as never, calls };
};

describe("spentTodayBy", () => {
  it("adds up today's lifestyle reservations of the brand that were not refunded", async () => {
    const { client, calls } = fakeClient({ data: [{ cost: 80000 }, { cost: "120000" }], error: null });
    expect(await spentTodayBy(client, "brand-1", new Date("2026-10-27T23:59:00Z"))).toBe(200_000);
    expect(calls).toContainEqual(["eq", "day", "2026-10-27"]);
    expect(calls).toContainEqual(["like", "route", `${LIFESTYLE_ROUTE_PREFIX}%`]);
    expect(calls).toContainEqual(["is", "refunded_at", null]);
  });

  it("is zero with no rows and throws when the read fails", async () => {
    expect(await spentTodayBy(fakeClient({ data: null, error: null }).client, "b")).toBe(0);
    await expect(spentTodayBy(fakeClient({ data: null, error: { message: "x" } }).client, "b")).rejects.toThrow("Today's spend");
  });
});
