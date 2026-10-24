import { describe, expect, it, vi } from "vitest";
import { recordInspection, type InspectionToRecord } from "./service";

const input: InspectionToRecord = {
  orderId: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11",
  checklist: [{ key: "colour", result: "pass", note: "" }],
  measurements: [{ point: "Chest", specMm: 520, measuredMm: 521, toleranceMm: 5 }],
  sampleSize: 5,
  defectCount: 0,
  photoFileIds: [],
  note: "",
  remake: null,
};

describe("recordInspection", () => {
  it("sends the actor and what was typed, and reads the answer back", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ inspection_id: "i1", result: "pass", exception_id: null }], error: null });
    const out = await recordInspection({ rpc } as never, "actor", input);
    expect(out).toEqual({ inspectionId: "i1", result: "pass", exceptionId: null });
    expect(rpc).toHaveBeenCalledWith("ops_record_inspection", expect.objectContaining({ p_actor: "actor", p_order_id: input.orderId, p_sample_size: 5, p_remake_sizes: null, p_remake_owner: null }));
  });

  it("sends the remake line of a fail", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ inspection_id: "i2", result: "fail", exception_id: "e1" }], error: null });
    const out = await recordInspection({ rpc } as never, "actor", { ...input, remake: { sizes: { M: 2 }, owner: "Sam", dueOn: "2026-11-05" } });
    expect(out.exceptionId).toBe("e1");
    expect(rpc).toHaveBeenCalledWith("ops_record_inspection", expect.objectContaining({ p_remake_sizes: { M: 2 }, p_remake_owner: "Sam", p_remake_due_on: "2026-11-05" }));
  });

  it("says why the database refused", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "raw", hint: "not_ready_for_qc" } });
    await expect(recordInspection({ rpc } as never, "actor", input)).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("listInspections", () => {
  it("reads rows as inspections and an empty answer as none", async () => {
    const { listInspections } = await import("./service");
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) q[m] = () => q;
    const row = { id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11", order_id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a12", factory_profile_id: "f", result: "pass", checklist: [], measurements: [], sample_size: 1, defect_count: 0, photo_file_ids: [], note: "", exception_id: null, at: "2026-10-26T10:00:00Z" };
    q.limit = () => Promise.resolve({ data: [row], error: null });
    expect(await listInspections({ from: () => q } as never, "o")).toHaveLength(1);
    q.limit = () => Promise.resolve({ data: null, error: null });
    expect(await listInspections({ from: () => q } as never, "o")).toEqual([]);
  });

  it("refuses an answer with nothing in it from the function", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await expect(recordInspection({ rpc } as never, "a", input)).rejects.toThrow(/nothing/);
  });
});
