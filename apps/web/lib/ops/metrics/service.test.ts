import { describe, expect, it } from "vitest";
import { DEFAULT_OPS_SETTINGS } from "../settings";
import { loadMetrics, METRICS_ROW_LIMIT } from "./service";

const table = (rows: unknown[], error: unknown = null) => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: rows, error }) }) }), maybeSingle: () => Promise.resolve({ data: null, error: null }) });

const fake = (tables: Record<string, ReturnType<typeof table>>) => ({
  from: (name: string) => (name === "ops_settings" ? { select: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) } : tables[name]),
});

describe("loadMetrics", () => {
  it("computes from empty tables with the default settings, and says it is not truncated", async () => {
    const client = fake({ ops_orders: table([]), ops_shipments: table([]), ops_qc_inspections: table([]), ops_exceptions: table([]) });
    const out = await loadMetrics(client as never, new Date("2026-10-28T10:00:00Z"));
    expect(out.truncated).toBe(false);
    expect(out.metrics.ordersThisWeek).toBe(0);
    expect(out.metrics.nextCutoff).toBe("2026-10-30T17:00:00.000Z");
    expect(DEFAULT_OPS_SETTINGS.cutoffWeekday).toBe(5);
  });

  it("says when a table hit the row limit, so the numbers are not presented as whole", async () => {
    const rows = Array.from({ length: METRICS_ROW_LIMIT }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, order_id: "00000000-0000-4000-8000-000000000001", factory_profile_id: "f", result: "pass", checklist: [], measurements: [], sample_size: 1, defect_count: 0, photo_file_ids: [], note: "", exception_id: null, at: "2026-10-26T10:00:00Z" }));
    const client = fake({ ops_orders: table([]), ops_shipments: table([]), ops_qc_inspections: table(rows), ops_exceptions: table([]) });
    expect((await loadMetrics(client as never)).truncated).toBe(true);
  });

  it("stops with a message when the database refuses", async () => {
    const client = fake({ ops_orders: table([], { message: "raw", code: "42501" }), ops_shipments: table([]), ops_qc_inspections: table([]), ops_exceptions: table([]) });
    await expect(loadMetrics(client as never)).rejects.toMatchObject({ code: "internal" });
  });
});
