import { describe, expect, it, vi } from "vitest";
import { loadScorecards } from "./service";

/** A query builder whose every step answers the same rows, so one fake serves every read. */
const reader = (rows: Readonly<Record<string, readonly unknown[]>>, error: unknown = null) => ({
  from: vi.fn((table: string) => {
    const answer = { data: rows[table] ?? [], error };
    const chain: Record<string, unknown> = {};
    for (const step of ["select", "order", "eq", "limit"]) chain[step] = () => chain;
    return Object.assign(chain, answer, { then: undefined });
  }),
});

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const orderRow = {
  id: ID(1),
  release_id: ID(2),
  brand_id: ID(3),
  project_id: ID(4),
  external_ref: "KW-1",
  factory_profile_id: "sialkot-partner",
  fabric_key: "f",
  article_id: "football-shirt",
  sizes: { M: 10 },
  pieces: 10,
  value_minor: null,
  currency: null,
  release_snapshot: { label: "R1", number: 1 },
  status: "ready",
  batch_id: ID(5),
  cutoff_at: "2026-12-01T12:00:00Z",
  lead_time_days: null,
  promised_on: "2026-12-05",
  created_at: "2026-12-01T10:00:00Z",
};

const rows = {
  ops_orders: [orderRow],
  ops_shipments: [],
  ops_qc_inspections: [{ id: ID(10), factory_profile_id: "sialkot-partner", result: "pass", sample_size: 20, defect_count: 0 }],
  ops_qc_colour_readings: [{ inspection_id: ID(10), delta_e: "1.200", limit_delta_e: "1.500" }],
  ops_exceptions: [],
  factories: [{ id: ID(20), slug: "sialkot-partner", name: "Sialkot partner" }],
  factory_capabilities: [{ factory_id: ID(20), article_code: "JSY-SS-01", golden_sample_status: "approved" }],
};

describe("loadScorecards", () => {
  it("counts a card from the rows, joining a colour reading to its inspection's factory", async () => {
    const client = reader(rows);
    const loaded = await loadScorecards(client as never, client as never, new Date("2026-12-07T10:00:00Z"));
    expect(loaded.cards).toHaveLength(1);
    expect(loaded.cards[0]).toMatchObject({ factoryProfileId: "sialkot-partner", isActive: true, colour: { readings: 1, judged: 1, inside: 1, rate: 1 } });
    expect(loaded.truncated).toBe(false);
  });

  it("leaves out a reading whose inspection it cannot see, rather than counting it against nobody", async () => {
    const client = reader({ ...rows, ops_qc_colour_readings: [{ inspection_id: ID(99), delta_e: 9, limit_delta_e: 1 }] });
    const loaded = await loadScorecards(client as never, client as never, new Date("2026-12-07T10:00:00Z"));
    expect(loaded.cards[0]?.colour.readings).toBe(0);
  });

  it("leaves out a capability whose factory it cannot see", async () => {
    const client = reader({ ...rows, factory_capabilities: [{ factory_id: ID(98), article_code: "JSY-SS-01", golden_sample_status: "approved" }] });
    const loaded = await loadScorecards(client as never, client as never, new Date("2026-12-07T10:00:00Z"));
    expect(loaded.cards[0]?.isActive).toBe(false);
  });

  it("refuses when a read fails, rather than showing a card counted from nothing", async () => {
    const client = reader(rows, { message: "raw", code: "42501" });
    await expect(loadScorecards(client as never, client as never)).rejects.toThrow();
  });
});
