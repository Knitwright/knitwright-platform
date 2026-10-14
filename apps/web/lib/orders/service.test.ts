import { describe, expect, it } from "vitest";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { fakeClient } from "./fixtures/fake-client";
import { deleteTeamOrder, getTeamOrder, listTeamOrders, saveTeamOrder } from "./service";

const BRAND = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const ORDER = "33333333-3333-4333-8333-333333333333";

describe("listTeamOrders", () => {
  it("reads the member's orders with a player count", async () => {
    const { client, calls } = fakeClient({ team_orders: { data: [{ id: ORDER, name: "Round 1", updated_at: "2026-10-15T00:00:00Z", team_order_rows: [{ count: 22 }] }] } });
    expect(await listTeamOrders(client, BRAND, PROJECT)).toEqual([{ id: ORDER, name: "Round 1", players: 22, updatedAt: "2026-10-15T00:00:00Z" }]);
    expect(calls[0]?.steps.map(([n]) => n)).toContain("eq");
  });
  it("says no players when the count is missing", async () => {
    const { client } = fakeClient({ team_orders: { data: [{ id: ORDER, name: "x", updated_at: "t", team_order_rows: [] }] } });
    expect((await listTeamOrders(client, BRAND, PROJECT))[0]?.players).toBe(0);
  });
  it("gives an empty list for no data", async () => {
    expect(await listTeamOrders(fakeClient({}).client, BRAND, PROJECT)).toEqual([]);
  });
  it("fails with a sentence when the database refuses", async () => {
    const { client } = fakeClient({ team_orders: { error: { code: "XX", message: "boom" } } });
    await expect(listTeamOrders(client, BRAND, PROJECT)).rejects.toMatchObject({ code: "internal" });
  });
});

describe("getTeamOrder", () => {
  const lines = ROSTER_22.rows.map((r) => ({ name: r.name, number: r.number, size_label: r.sizeLabel, cut: r.cut, quantity: r.quantity }));
  it("reads an order and its rows back as roster rows", async () => {
    const { client } = fakeClient({
      team_orders: { data: { id: ORDER, name: "Round 1", updated_at: "t" } },
      team_order_rows: { data: lines },
    });
    const order = await getTeamOrder(client, BRAND, PROJECT, ORDER);
    expect(order.rows).toEqual(ROSTER_22.rows);
    expect(order.name).toBe("Round 1");
  });
  it("is not found when there is no such order", async () => {
    await expect(getTeamOrder(fakeClient({}).client, BRAND, PROJECT, ORDER)).rejects.toMatchObject({ code: "not_found" });
  });
  it("fails when the rows cannot be read", async () => {
    const { client } = fakeClient({ team_orders: { data: { id: ORDER, name: "x", updated_at: "t" } }, team_order_rows: { error: { code: "XX", message: "m" } } });
    await expect(getTeamOrder(client, BRAND, PROJECT, ORDER)).rejects.toMatchObject({ code: "internal" });
  });
  it("fails when the head cannot be read", async () => {
    const { client } = fakeClient({ team_orders: { error: { code: "22P02", message: "m" } } });
    await expect(getTeamOrder(client, BRAND, PROJECT, ORDER)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("saveTeamOrder", () => {
  it("sends the rows in the database's own names and returns the id", async () => {
    const { client, calls } = fakeClient({ save_team_order: { data: ORDER } });
    const id = await saveTeamOrder(client, { projectId: PROJECT, brandId: BRAND, userId: BRAND, name: "T", rows: ROSTER_22.rows.slice(0, 1) });
    expect(id).toBe(ORDER);
    const args = calls[0]?.steps[0]?.[1][0] as { p_rows: unknown[]; p_order_id: unknown };
    expect(args.p_order_id).toBeNull();
    expect(args.p_rows[0]).toEqual({ name: "OKAFOR", number: "7", size_label: "M", cut: "mens", quantity: 1 });
  });
  it("says the order is missing when replacing one that is not there", async () => {
    const { client } = fakeClient({ save_team_order: { error: { code: "P0002", message: "m" } } });
    await expect(saveTeamOrder(client, { orderId: ORDER, projectId: PROJECT, brandId: BRAND, userId: BRAND, name: "T", rows: [] })).rejects.toMatchObject({ message: "That team order does not exist." });
  });
  it("says the design is missing when creating", async () => {
    const { client } = fakeClient({ save_team_order: { error: { code: "P0002", message: "m" } } });
    await expect(saveTeamOrder(client, { projectId: PROJECT, brandId: BRAND, userId: BRAND, name: "T", rows: [] })).rejects.toMatchObject({ message: "That design does not exist." });
  });
});

describe("deleteTeamOrder", () => {
  it("erases the order", async () => {
    const { client } = fakeClient({ team_orders: { data: [{ id: ORDER }] } });
    await expect(deleteTeamOrder(client, BRAND, PROJECT, ORDER)).resolves.toBeUndefined();
  });
  it("says not found when nothing was erased", async () => {
    await expect(deleteTeamOrder(fakeClient({ team_orders: { data: [] } }).client, BRAND, PROJECT, ORDER)).rejects.toMatchObject({ code: "not_found" });
  });
  it("fails when the database refuses", async () => {
    const { client } = fakeClient({ team_orders: { error: { code: "XX", message: "m" } } });
    await expect(deleteTeamOrder(client, BRAND, PROJECT, ORDER)).rejects.toMatchObject({ code: "internal" });
  });
});
