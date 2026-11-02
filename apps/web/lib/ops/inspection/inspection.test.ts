import { describe, expect, it, vi } from "vitest";
import { loadThirdPartyOverPieces } from "./load";
import { NO_INSPECTION_PROVIDER, referenceFor, selectInspectionProvider, stubInspectionProvider } from "./provider";
import { bookingBlocker, isOverThreshold } from "./rules";
import { bookInspectionSchema } from "./schemas";
import { bookInspection, listBookings, toBooking } from "./service";
import { DEFAULT_THIRD_PARTY_OVER_PIECES } from "./settings";

const request = { orderRef: "KW-0001", pieces: 400, place: "Sialkot, PK", requestedOn: "2026-12-07" };

describe("the provider", () => {
  it("books nothing, says so, and never reaches a network", async () => {
    const booking = await stubInspectionProvider.book(request);
    expect(booking).toEqual({ state: "not_available", provider: "stub", reference: referenceFor(request), outcome: NO_INSPECTION_PROVIDER });
  });

  it("gives the same reference for the same request, and a different one for another day", () => {
    expect(referenceFor(request)).toBe(referenceFor({ ...request }));
    expect(referenceFor({ ...request, requestedOn: "2026-12-08" })).not.toBe(referenceFor(request));
    expect(referenceFor(request)).toMatch(/^KW-TPI-[0-9A-F]{10}$/);
  });

  it("is the stub whatever the environment says, because there is no adapter yet", () => {
    expect(selectInspectionProvider({}).name).toBe("stub");
    expect(selectInspectionProvider({ INSPECTION_PROVIDER: "someone" }).name).toBe("stub");
  });
});

describe("who may be offered one", () => {
  it("is a run over the threshold, not one at it", () => {
    expect(isOverThreshold(301, 300)).toBe(true);
    expect(isOverThreshold(300, 300)).toBe(false);
  });

  it("says which gate blocks a booking and what would clear it", () => {
    expect(bookingBlocker({ pieces: 200, overPieces: 300, status: "ready", alreadyBooked: false })).toContain("/admin/settings");
    expect(bookingBlocker({ pieces: 400, overPieces: 300, status: "held", alreadyBooked: false })).toContain("Let the hold go");
    expect(bookingBlocker({ pieces: 400, overPieces: 300, status: "submitted", alreadyBooked: false })).toContain("not in a batch yet");
    expect(bookingBlocker({ pieces: 400, overPieces: 300, status: "ready", alreadyBooked: true })).toContain("already been asked for");
  });

  it("blocks nothing for a run over the threshold the factory has", () => {
    expect(bookingBlocker({ pieces: 400, overPieces: 300, status: "in_production", alreadyBooked: false })).toBeNull();
  });
});

describe("the form", () => {
  it("needs a real day and a place, and gives R-GAP-000 where no rule explains the check", () => {
    const parsed = bookInspectionSchema.safeParse({ orderId: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11", requestedOn: "2026-12-07", place: "Sialkot, PK" });
    expect(parsed.success && parsed.data.ruleId).toBe("R-GAP-000");
    expect(bookInspectionSchema.safeParse({ orderId: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11", requestedOn: "2026-02-31", place: "x" }).success).toBe(false);
    expect(bookInspectionSchema.safeParse({ orderId: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11", requestedOn: "2026-12-07", place: "" }).success).toBe(false);
  });
});

const row = {
  id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11",
  order_id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a12",
  provider: "stub",
  reference: "KW-TPI-ABCDEF0123",
  pieces: 400,
  requested_on: "2026-12-07",
  inspect_on: null,
  state: "not_available",
  outcome: NO_INSPECTION_PROVIDER,
  note: "",
  rule_id: "R-GAP-000",
  at: "2026-12-07T10:00:00Z",
};

describe("bookInspection", () => {
  it("records exactly what the provider said, and invents no date", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: row.id, error: null });
    const out = await bookInspection({ rpc } as never, "actor", { ...request, orderId: row.order_id, note: "", ruleId: "R-GAP-000" });
    expect(out).toMatchObject({ id: row.id, state: "not_available" });
    expect(rpc).toHaveBeenCalledWith("ops_book_inspection", expect.objectContaining({ p_state: "not_available", p_inspect_on: null, p_provider: "stub" }));
  });

  it("keeps the date a provider that books one gives", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row.id], error: null });
    const provider = { name: "x", describe: "", book: async () => ({ state: "booked" as const, provider: "x", reference: "R1", inspectOn: "2026-12-10", outcome: "Booked" }) };
    await bookInspection({ rpc } as never, "actor", { ...request, orderId: row.order_id, note: "", ruleId: "R-GAP-000" }, provider);
    expect(rpc).toHaveBeenCalledWith("ops_book_inspection", expect.objectContaining({ p_inspect_on: "2026-12-10" }));
  });

  it("refuses when the database does, and when it answers with nothing", async () => {
    const bad = vi.fn().mockResolvedValue({ data: null, error: { message: "raw", code: "P0002" } });
    await expect(bookInspection({ rpc: bad } as never, "a", { ...request, orderId: row.order_id, note: "", ruleId: "R-GAP-000" })).rejects.toThrow();
    const empty = vi.fn().mockResolvedValue({ data: null, error: null });
    await expect(bookInspection({ rpc: empty } as never, "a", { ...request, orderId: row.order_id, note: "", ruleId: "R-GAP-000" })).rejects.toThrow(/answered with nothing/);
  });
});

describe("reading the bookings", () => {
  it("reads a booking row", () => {
    expect(toBooking(row)).toMatchObject({ reference: row.reference, state: "not_available", inspectOn: null });
  });

  it("lists an order's bookings, newest first", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [row], error: null });
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ order: () => ({ limit }) }) }) }));
    expect(await listBookings({ from } as never, row.order_id)).toHaveLength(1);
  });

  it("refuses when the read fails", async () => {
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ data: null, error: { message: "raw", code: "P0002" } }) }) }) }) }));
    await expect(listBookings({ from } as never, row.order_id)).rejects.toThrow();
  });
});

describe("the threshold", () => {
  it("is the stored setting", async () => {
    const from = vi.fn(() => ({ select: () => ({ data: [{ key: "ops.third_party_inspection_over_pieces", value: 500, set_by: null, set_at: "2026-12-01T00:00:00Z" }], error: null }) }));
    expect(await loadThirdPartyOverPieces({ from } as never)).toBe(500);
  });

  it("is the spec's own figure while nothing is stored, and when the read fails", async () => {
    const empty = vi.fn(() => ({ select: () => ({ data: [], error: null }) }));
    expect(await loadThirdPartyOverPieces({ from: empty } as never)).toBe(DEFAULT_THIRD_PARTY_OVER_PIECES);
    const broken = vi.fn(() => {
      throw new Error("down");
    });
    expect(await loadThirdPartyOverPieces({ from: broken } as never)).toBe(DEFAULT_THIRD_PARTY_OVER_PIECES);
  });
});
