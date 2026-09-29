import { describe, expect, it } from "vitest";
import type { CeilingAlert } from "./alert";
import { createUsageMeter, type Allowances, type UsageRpc } from "./meter";

const ALLOWANCES: Allowances = {
  user: { ai: 100, photoreal: 200 },
  brand: { ai: 1000, photoreal: 2000 },
  globalCeiling: 50_000,
};

type Call = { fn: string; args: Record<string, unknown> };

const fakeRpc = (answer: { data: unknown; error: { message: string } | null }) => {
  const calls: Call[] = [];
  const rpc: UsageRpc = async (fn, args) => {
    calls.push({ fn, args });
    return answer;
  };
  return { rpc, calls };
};

const collect = () => {
  const alerts: CeilingAlert[] = [];
  return { alerts, alert: async (event: CeilingAlert) => void alerts.push(event) };
};

const REQUEST = {
  userId: "user-1",
  brandId: "brand-1",
  cost: { feature: "photoreal", microdollars: 40 },
  route: "POST /api/images",
} as const;

describe("createUsageMeter", () => {
  it("reserves with the allowances for the feature and returns the event", async () => {
    const { rpc, calls } = fakeRpc({
      data: { ok: true, event_id: "event-1", global_spent: 40, global_ceiling: 50_000, alerts: [] },
      error: null,
    });
    const meter = createUsageMeter({ rpc, allowances: ALLOWANCES, alert: collect().alert });

    expect(await meter.reserve(REQUEST)).toEqual({ ok: true, eventId: "event-1" });
    expect(calls).toEqual([
      {
        fn: "usage_reserve",
        args: {
          p_user_id: "user-1",
          p_brand_id: "brand-1",
          p_feature: "photoreal",
          p_cost: 40,
          p_route: "POST /api/images",
          p_user_allowance: 200,
          p_brand_allowance: 2000,
          p_global_ceiling: 50_000,
        },
      },
    ]);
  });

  it.each(["user", "brand", "global"] as const)("reports a refusal by the %s limit", async (by) => {
    const { rpc } = fakeRpc({
      data: { ok: false, refused: by, global_spent: 7, global_ceiling: 50_000, alerts: [] },
      error: null,
    });
    const meter = createUsageMeter({ rpc, allowances: ALLOWANCES, alert: collect().alert });

    expect(await meter.reserve(REQUEST)).toEqual({ ok: false, refused: by });
  });

  it("raises each ceiling alert the database reports, with the day's total", async () => {
    const { rpc } = fakeRpc({
      data: {
        ok: true,
        event_id: "event-2",
        global_spent: 50_000,
        global_ceiling: 50_000,
        alerts: ["half", "full"],
      },
      error: null,
    });
    const { alerts, alert } = collect();
    const meter = createUsageMeter({ rpc, allowances: ALLOWANCES, alert });

    await meter.reserve(REQUEST);

    expect(alerts).toEqual([
      { level: "half", spent: 50_000, ceiling: 50_000 },
      { level: "full", spent: 50_000, ceiling: 50_000 },
    ]);
  });

  it("still answers when raising an alert fails", async () => {
    const { rpc } = fakeRpc({
      data: { ok: false, refused: "global", global_spent: 1, global_ceiling: 1, alerts: ["full"] },
      error: null,
    });
    const meter = createUsageMeter({
      rpc,
      allowances: ALLOWANCES,
      alert: async () => {
        throw new Error("no mail today");
      },
    });

    expect(await meter.reserve(REQUEST)).toEqual({ ok: false, refused: "global" });
  });

  it("throws when the reservation cannot be made, so no call runs unmetered", async () => {
    const { rpc } = fakeRpc({ data: null, error: { message: "connection lost" } });
    const meter = createUsageMeter({ rpc, allowances: ALLOWANCES, alert: collect().alert });

    await expect(meter.reserve(REQUEST)).rejects.toThrow("could not be reserved");
  });

  it("throws on an answer it does not recognise", async () => {
    const { rpc } = fakeRpc({ data: { ok: "maybe" }, error: null });
    const meter = createUsageMeter({ rpc, allowances: ALLOWANCES, alert: collect().alert });

    await expect(meter.reserve(REQUEST)).rejects.toThrow("could not be reserved");
  });

  it.each([0, -1, 1.5, Number.NaN])("refuses to reserve a cost of %s", async (microdollars) => {
    const { rpc, calls } = fakeRpc({ data: null, error: null });
    const meter = createUsageMeter({ rpc, allowances: ALLOWANCES, alert: collect().alert });

    await expect(
      meter.reserve({ ...REQUEST, cost: { feature: "ai", microdollars } }),
    ).rejects.toThrow("whole number");
    expect(calls).toEqual([]);
  });

  it("refunds an event and says whether anything was given back", async () => {
    const { rpc, calls } = fakeRpc({ data: true, error: null });
    const meter = createUsageMeter({ rpc, allowances: ALLOWANCES, alert: collect().alert });

    expect(await meter.refund("event-1")).toBe(true);
    expect(calls).toEqual([{ fn: "usage_refund", args: { p_event_id: "event-1" } }]);
  });

  it("throws when a refund cannot be made", async () => {
    const { rpc } = fakeRpc({ data: null, error: { message: "gone" } });
    const meter = createUsageMeter({ rpc, allowances: ALLOWANCES, alert: collect().alert });

    await expect(meter.refund("event-1")).rejects.toThrow("could not be refunded");
  });
});
