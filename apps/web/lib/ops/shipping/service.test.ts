import { describe, expect, it, vi } from "vitest";
import { recordShipment, type ParcelToRecord } from "./service";

const parcel: ParcelToRecord = { orderId: "o", courier: " DHL ", trackingNumber: "T1 ", shippedOn: "2026-10-30", sizes: { M: 2 }, note: "", rest: null };

describe("recordShipment", () => {
  it("sends the courier and number through the provider, and reads the answer", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ shipment_id: "s1", shipped_pieces: 2, complete: false }], error: null });
    expect(await recordShipment({ rpc } as never, "actor", parcel)).toEqual({ shipmentId: "s1", pieces: 2, complete: false });
    expect(rpc).toHaveBeenCalledWith("ops_record_shipment", expect.objectContaining({ p_actor: "actor", p_courier: "DHL", p_tracking_number: "T1", p_owner: null, p_due_on: null }));
  });

  it("sends the owner and date for what is left behind", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ shipment_id: "s1", shipped_pieces: 2, complete: false }], error: null });
    await recordShipment({ rpc } as never, "actor", { ...parcel, rest: { owner: "Sam", dueOn: "2026-11-05" } });
    expect(rpc).toHaveBeenCalledWith("ops_record_shipment", expect.objectContaining({ p_owner: "Sam", p_due_on: "2026-11-05" }));
  });

  it("says why the database refused, in words", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "raw", hint: "qc_not_passed" } });
    await expect(recordShipment({ rpc } as never, "actor", parcel)).rejects.toThrow(/not a pass/);
  });

  it("uses the provider it is given", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ shipment_id: "s1", shipped_pieces: 2, complete: true }], error: null });
    const prepare = vi.fn().mockResolvedValue({ provider: "manual", courier: "Other", trackingNumber: "Z9", trackingUrl: null });
    await recordShipment({ rpc } as never, "actor", parcel, { id: "manual", describe: "", prepare });
    expect(rpc).toHaveBeenCalledWith("ops_record_shipment", expect.objectContaining({ p_courier: "Other", p_tracking_number: "Z9" }));
  });
});

describe("listShipments and an empty answer", () => {
  it("reads parcels, and refuses a function that answers with nothing", async () => {
    const { listShipments } = await import("./service");
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) q[m] = () => q;
    const row = { id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11", order_id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a12", provider: "manual", courier: "DHL", tracking_number: "T", shipped_on: "2026-10-30", sizes: { M: 1 }, pieces: 1, note: "", at: "2026-10-30T09:00:00Z" };
    q.limit = () => Promise.resolve({ data: [row], error: null });
    expect((await listShipments({ from: () => q } as never, "o"))[0]).toMatchObject({ courier: "DHL", trackingNumber: "T" });
    q.limit = () => Promise.resolve({ data: null, error: null });
    expect(await listShipments({ from: () => q } as never, "o")).toEqual([]);
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await expect(recordShipment({ rpc } as never, "a", parcel)).rejects.toThrow(/nothing/);
  });
});
