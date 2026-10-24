import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/core/errors";

const getRelease = vi.fn();
const getTeamOrder = vi.fn();
vi.mock("@/lib/releases/service", () => ({ getRelease: (...a: unknown[]) => getRelease(...a) }));
vi.mock("@/lib/orders/service", () => ({ getTeamOrder: (...a: unknown[]) => getTeamOrder(...a) }));

import { sampleOrder } from "../factory-sheet/fixtures";
import { brandNameOf, listBags, listCartons, loadTeamList } from "./service";
import { toBag, toCarton } from "./rows";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const order = sampleOrder(1);

/** A query that ends at whichever call the code makes last. */
const chain = (result: unknown) => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q;
  q.maybeSingle = () => Promise.resolve(result);
  q.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
};
const client = (result: unknown) => ({ from: () => chain(result) }) as never;

beforeEach(() => {
  getRelease.mockReset();
  getTeamOrder.mockReset();
});

describe("loadTeamList", () => {
  it("is no list for a release without a team order", async () => {
    getRelease.mockResolvedValue({ orderId: null });
    expect(await loadTeamList({} as never, order)).toEqual({ teamOrderId: null, roster: null });
  });

  it("reads the rows of the team order", async () => {
    getRelease.mockResolvedValue({ orderId: ID(5) });
    getTeamOrder.mockResolvedValue({ rows: [{ name: "A", number: "1", sizeLabel: "M", cut: "mens", quantity: 1 }] });
    expect((await loadTeamList({} as never, order)).roster).toHaveLength(1);
  });

  it("treats an erased list as missing, and any other failure as a failure", async () => {
    getRelease.mockResolvedValue({ orderId: ID(5) });
    getTeamOrder.mockRejectedValueOnce(new AppError("not_found", "gone"));
    expect(await loadTeamList({} as never, order)).toEqual({ teamOrderId: ID(5), roster: null });
    getTeamOrder.mockRejectedValueOnce(new AppError("internal", "boom"));
    await expect(loadTeamList({} as never, order)).rejects.toMatchObject({ code: "internal" });
  });
});

describe("reads", () => {
  it("lists bags and cartons as typed rows", async () => {
    const bag = { id: ID(1), order_id: ID(2), bag_no: 1, team_order_id: null, team_row_position: null, size_label: "M", pieces: 1, carton_no: 1, packed_at: "2026-10-26T10:00:00Z" };
    const carton = { id: ID(3), order_id: ID(2), carton_no: 1, weight_g: null, length_mm: 400, width_mm: null, height_mm: null };
    expect((await listBags(client({ data: [bag], error: null }), ID(2)))[0]).toMatchObject({ bagNo: 1, packedAt: "2026-10-26T10:00:00.000Z" });
    expect((await listCartons(client({ data: [carton], error: null }), ID(2)))[0]).toMatchObject({ weightG: null, lengthMm: 400 });
    expect(await listBags(client({ data: null, error: null }), ID(2))).toEqual([]);
    expect(toBag({ ...bag, packed_at: null }).packedAt).toBeNull();
    expect(toCarton(carton).cartonNo).toBe(1);
  });

  it("stops with a message when the database refuses", async () => {
    await expect(listBags(client({ data: null, error: { message: "raw", code: "42501" } }), ID(2))).rejects.toMatchObject({ code: "internal" });
  });

  it("names the brand, or says it is unknown", async () => {
    expect(await brandNameOf(client({ data: { name: "Northside" }, error: null }), ID(9))).toBe("Northside");
    expect(await brandNameOf(client({ data: null, error: null }), ID(9))).toBe("Unknown brand");
  });
});
