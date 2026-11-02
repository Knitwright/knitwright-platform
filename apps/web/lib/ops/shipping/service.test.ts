import { describe, expect, it, vi } from "vitest";
import { listCouriers, manualCourier, toCourier, trackingUrlFor, selectCourierProvider, type Courier } from "./courier";
import { listShipments, recordShipment, type ParcelToRecord } from "./service";

const parcel: ParcelToRecord = { orderId: "o", courier: " DHL ", trackingNumber: "T1 ", shippedOn: "2026-10-30", sizes: { M: 2 }, note: "", rest: null };

const courierRow = {
  code: "by-hand",
  name: "Entered by hand",
  provider: "manual",
  tracking_url_template: null,
  terms: "",
  transit_days: null,
  active: true,
  rule_id: "R-GAP-000",
  label: "The manual option",
};

const withTracking: Courier = { ...toCourier(courierRow), code: "a-courier", name: "A courier", trackingUrlTemplate: "https://track.example/{tracking}" };

describe("recordShipment", () => {
  it("books through the courier provider, sends what it answered, and reads the result", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ shipment_id: "s1", shipped_pieces: 2, complete: false }], error: null });
    expect(await recordShipment({ rpc } as never, "actor", parcel)).toMatchObject({ shipmentId: "s1", pieces: 2, complete: false, trackingUrl: null });
    expect(rpc).toHaveBeenCalledWith("ops_record_shipment", expect.objectContaining({ p_actor: "actor", p_courier: "DHL", p_tracking_number: "T1", p_owner: null, p_due_on: null, p_provider: "manual", p_courier_code: null, p_tracking_url: null }));
  });

  it("sends the owner and date for what is left behind", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ shipment_id: "s1", shipped_pieces: 2, complete: false }], error: null });
    await recordShipment({ rpc } as never, "actor", { ...parcel, rest: { owner: "Sam", dueOn: "2026-11-05" } });
    expect(rpc).toHaveBeenCalledWith("ops_record_shipment", expect.objectContaining({ p_owner: "Sam", p_due_on: "2026-11-05" }));
  });

  it("records the courier row and its tracking page when ops chose one", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ shipment_id: "s1", shipped_pieces: 2, complete: true }], error: null });
    const out = await recordShipment({ rpc } as never, "actor", { ...parcel, courierRow: withTracking });
    expect(out.trackingUrl).toBe("https://track.example/T1");
    expect(rpc).toHaveBeenCalledWith("ops_record_shipment", expect.objectContaining({ p_courier_code: "a-courier", p_tracking_url: "https://track.example/T1" }));
  });

  it("says why the database refused, in words", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "raw", hint: "qc_not_passed" } });
    await expect(recordShipment({ rpc } as never, "actor", parcel)).rejects.toThrow(/not a pass/);
  });

  it("refuses an answer with nothing in it", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await expect(recordShipment({ rpc } as never, "actor", parcel)).rejects.toThrow(/nothing/);
  });

  it("uses the provider it is given, so a real adapter has one seam", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ shipment_id: "s1", shipped_pieces: 2, complete: true }], error: null });
    const book = vi.fn().mockResolvedValue({ provider: "courier", courier: "Other", courierCode: null, trackingNumber: "Z9", trackingUrl: null, outcome: "Booked" });
    await recordShipment({ rpc } as never, "actor", parcel, { name: "x", describe: "", book });
    expect(rpc).toHaveBeenCalledWith("ops_record_shipment", expect.objectContaining({ p_courier: "Other", p_tracking_number: "Z9", p_provider: "courier" }));
  });
});

describe("listShipments", () => {
  const row = {
    id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a41",
    order_id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11",
    provider: "manual",
    courier: "DHL",
    tracking_number: "T1",
    shipped_on: "2026-12-07",
    sizes: { M: 2 },
    pieces: 2,
    note: "",
    courier_code: "by-hand",
    tracking_url: null,
    at: "2026-12-07T10:00:00Z",
  };
  const reader = (answer: { data: unknown; error: unknown }) =>
    vi.fn(() => ({ select: () => ({ eq: () => ({ order: () => ({ order: () => ({ limit: () => answer }) }) }) }) }));

  it("reads an order's parcels with the courier row and the tracking address", async () => {
    const shipments = await listShipments({ from: reader({ data: [row], error: null }) } as never, row.order_id);
    expect(shipments[0]).toMatchObject({ courierCode: "by-hand", trackingUrl: null, provider: "manual" });
  });

  it("treats a row with no courier columns as one with none, so an older parcel still reads", async () => {
    const older: Record<string, unknown> = { ...row };
    delete older.courier_code;
    delete older.tracking_url;
    const shipments = await listShipments({ from: reader({ data: [older], error: null }) } as never, row.order_id);
    expect(shipments[0]).toMatchObject({ courierCode: null, trackingUrl: null });
  });

  it("refuses when the read fails", async () => {
    const from = reader({ data: null, error: { message: "raw", hint: "qc_not_passed" } });
    await expect(listShipments({ from } as never, row.order_id)).rejects.toThrow(/not a pass/);
  });
});

describe("couriers as data", () => {
  it("reads a courier row", () => {
    expect(toCourier(courierRow)).toMatchObject({ code: "by-hand", trackingUrlTemplate: null, transitDays: null, terms: "" });
  });

  it("builds a tracking address only from a template on file, and escapes the number", () => {
    expect(trackingUrlFor(withTracking, "T 1/2")).toBe("https://track.example/T%201%2F2");
    expect(trackingUrlFor(toCourier(courierRow), "T1")).toBeNull();
    expect(trackingUrlFor(null, "T1")).toBeNull();
  });

  it("falls back to the courier row's name when ops typed none", async () => {
    expect(await manualCourier.book({ courier: withTracking, courierName: "  ", trackingNumber: "T1" })).toMatchObject({ courier: "A courier", courierCode: "a-courier" });
  });

  it("leaves the courier empty when neither a row nor a typed name gives one", async () => {
    expect(await manualCourier.book({ courier: null, courierName: "   ", trackingNumber: "T1" })).toMatchObject({ courier: "", courierCode: null, trackingUrl: null });
  });

  it("is the manual option whatever the environment says, because no courier adapter exists", () => {
    expect(selectCourierProvider({}).name).toBe("manual");
    expect(selectCourierProvider({ COURIER_PROVIDER: "someone" }).name).toBe("manual");
  });

  it("lists the couriers on file", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [courierRow], error: null });
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ order: () => ({ limit }) }) }) }));
    expect(await listCouriers({ from } as never)).toHaveLength(1);
  });

  it("refuses when the read fails", async () => {
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ data: null, error: { message: "raw", code: "P0002" } }) }) }) }) }));
    await expect(listCouriers({ from } as never)).rejects.toThrow();
  });
});
