import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { opsFailure } from "./errors";
import { cutBatches, delayOrder, listBatches, listWaitingOrders, loadBatch, loadOrder, loadSettings, moveOrder, movableBatches, saveSettings, setHold, setOrderStatus } from "./service";
import { DEFAULT_OPS_SETTINGS } from "./settings";
import { toSettings } from "./rows";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const orderRow = (n: number, over: Record<string, unknown> = {}) => ({
  id: ID(n), release_id: ID(900), brand_id: ID(901), project_id: ID(902), external_ref: `S-${n}`, factory_profile_id: "f1", fabric_key: "mesh", article_id: "team-jersey",
  sizes: { M: 2 }, pieces: 2, value_minor: 500, currency: "AUD", release_snapshot: { label: "Round 1", number: 1, rosterHash: null, files: 3 }, status: "batched", batch_id: ID(100),
  cutoff_at: "2026-10-23T17:00:00+00:00", lead_time_days: null, promised_on: null, created_at: "2026-10-21T09:00:00+00:00", ...over,
});
const batchRow = (n: number) => ({ id: ID(n), factory_profile_id: "f1", fabric_key: "mesh", article_id: "team-jersey", cutoff_at: "2026-10-23T17:00:00+00:00" });

/** A query builder that answers every chain with the rows of its table. */
const fake = (tables: Record<string, unknown[] | null>, error: { message: string; code?: string } | null = null) => {
  const chain = (rows: unknown[] | null) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "not", "is", "order", "limit"]) q[m] = () => q;
    q.maybeSingle = async () => ({ data: rows?.[0] ?? null, error });
    q.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error });
    return q;
  };
  return { from: (table: string) => chain(table in tables ? tables[table]! : []) } as never;
};

describe("reads", () => {
  it("lists batches with pieces, sizes, value and a count by status", async () => {
    const list = await listBatches(fake({ batches: [batchRow(100)], ops_orders: [orderRow(1), orderRow(2, { status: "received", sizes: { L: 1 }, pieces: 1 }), orderRow(3, { batch_id: ID(200), status: "batched" })] }));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: ID(100), orders: 2, byStatus: { batched: 1, received: 1 } });
    expect(list[0]?.summary).toEqual({ pieces: 3, sizes: { L: 1, M: 2 }, value: { minor: 1000, currency: "AUD" } });
  });

  it("lists orders waiting or held", async () => {
    const waiting = await listWaitingOrders(fake({ ops_orders: [orderRow(1, { status: "held", batch_id: null })] }));
    expect(waiting[0]).toMatchObject({ status: "held", batchId: null, release: { label: "Round 1" } });
  });

  it("loads one batch with its orders, and says not found for a missing one", async () => {
    const found = await loadBatch(fake({ batches: [batchRow(100)], ops_orders: [orderRow(1)] }), ID(100));
    expect(found.orders).toHaveLength(1);
    await expect(loadBatch(fake({}), ID(100))).rejects.toMatchObject({ code: "not_found" });
  });

  it("loads one order with its history", async () => {
    const ev = { id: ID(50), kind: "submitted", from_status: null, to_status: "submitted", promised_on: null, note: "", at: "2026-10-21T09:00:00+00:00" };
    const out = await loadOrder(fake({ ops_orders: [orderRow(1)], ops_order_events: [ev] }), ID(1));
    expect(out.events).toEqual([{ id: ID(50), kind: "submitted", fromStatus: null, toStatus: "submitted", promisedOn: null, note: "", at: "2026-10-21T09:00:00.000Z" }]);
    await expect(loadOrder(fake({}), ID(1))).rejects.toBeInstanceOf(AppError);
  });

  it("offers the other batches of the same factory, fabric and article", async () => {
    const { order } = await loadOrder(fake({ ops_orders: [orderRow(1)], ops_order_events: [] }), ID(1));
    const others = await movableBatches(fake({ batches: [batchRow(100), batchRow(101)] }), order);
    expect(others.map((b) => b.id)).toEqual([ID(101)]);
  });

  it("fails with the ops message when the database refuses", async () => {
    await expect(listWaitingOrders(fake({}, { message: "x", code: "P0002" }))).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("reads that come back with no rows at all", () => {
  it("treat missing data as an empty list", async () => {
    const empty = fake({ batches: null, ops_orders: null, ops_order_events: null });
    expect(await listBatches(empty)).toEqual([]);
    expect(await listWaitingOrders(empty)).toEqual([]);
    expect(await movableBatches(empty, (await loadOrder(fake({ ops_orders: [orderRow(1)], ops_order_events: null }), ID(1))).order)).toEqual([]);
    expect((await loadOrder(fake({ ops_orders: [orderRow(1)], ops_order_events: null }), ID(1))).events).toEqual([]);
    expect((await loadBatch(fake({ batches: [batchRow(100)], ops_orders: null }), ID(100))).orders).toEqual([]);
  });

  it("count nothing when the database answers with something that is not a number", async () => {
    expect(await cutBatches({ rpc: async () => ({ data: null, error: null }) } as never, "u1")).toBe(0);
  });
});

describe("settings", () => {
  it("reads the stored row, and falls back to the labelled default when it cannot", async () => {
    const stored = { cutoff_weekday: 2, cutoff_time: "09:30:00", lead_time_days: 21, label: "Agreed with Factory X" };
    expect(await loadSettings(fake({ ops_settings: [stored] }))).toEqual({ cutoffWeekday: 2, cutoffMinutes: 570, leadTimeDays: 21, label: "Agreed with Factory X" });
    expect(toSettings({ nonsense: true })).toEqual(DEFAULT_OPS_SETTINGS);
  });
});

describe("writes", () => {
  const rpc = (answer: { data?: unknown; error?: { message: string; hint?: string; code?: string } | null }) => {
    const calls: [string, Record<string, unknown>][] = [];
    return { calls, client: { rpc: async (name: string, args: Record<string, unknown>) => (calls.push([name, args]), { data: answer.data ?? null, error: answer.error ?? null }) } as never };
  };

  it("sends the actor and the arguments the SQL functions take", async () => {
    const { calls, client } = rpc({ data: 4 });
    expect(await cutBatches(client, "u1", new Date("2026-10-24T00:00:00Z"))).toBe(4);
    await moveOrder(client, "u1", "o1", "b1", "n");
    await setHold(client, "u1", "o1", true, "n");
    await setOrderStatus(client, "u1", "o1", "received");
    await delayOrder(client, "u1", "o1", "2026-12-01", "Yarn late");
    await saveSettings(client, "u1", { cutoffWeekday: 5, cutoffMinutes: 1020, leadTimeDays: null, label: "x" });
    expect(calls.map(([n]) => n)).toEqual(["ops_cut_batches", "ops_move_order", "ops_set_hold", "ops_set_order_status", "ops_delay_order", "ops_update_settings"]);
    expect(calls[0]?.[1]).toEqual({ p_actor: "u1", p_now: "2026-10-24T00:00:00.000Z" });
    expect(calls[4]?.[1]).toEqual({ p_actor: "u1", p_order_id: "o1", p_new_date: "2026-12-01", p_reason: "Yarn late" });
  });

  it("omits the clock so the database uses its own", async () => {
    const { calls, client } = rpc({ data: 0 });
    await cutBatches(client, "u1");
    expect(calls[0]?.[1]).toEqual({ p_actor: "u1" });
  });

  it("turns refusals into readable failures", async () => {
    await expect(setOrderStatus(rpc({ error: { message: "x", hint: "illegal_transition" } }).client, "u", "o", "ready")).rejects.toMatchObject({ code: "conflict", message: expect.stringMatching(/one step at a time/) });
    await expect(setHold(rpc({ error: { message: "x", code: "P0002" } }).client, "u", "o", true)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("opsFailure", () => {
  it("maps each kind of database error", () => {
    expect(opsFailure({ message: "", code: "22023" }).code).toBe("invalid_input");
    expect(opsFailure({ message: "", hint: "reason_needed" }).message).toMatch(/reason/);
    expect(opsFailure({ message: "boom" }).code).toBe("internal");
  });
});
