import { describe, expect, it, vi } from "vitest";
import { ROSTER_3, SAMPLE_BATCH, sampleOrder } from "@/lib/ops/factory-sheet/fixtures";
import { DEFAULT_OPS_SETTINGS } from "@/lib/ops/settings";
import { historyLines, loadPacketPage, type PacketLoadDeps } from "./load";
import type { FactoryEvent, OpenPacket } from "./service";
import type { FactoryEventKind } from "./steps";
import { newPacketToken } from "./token";

const PACKET: OpenPacket = { packetId: "11111111-1111-4111-8111-111111111111", batchId: SAMPLE_BATCH.id, expiresAt: "2026-11-29T09:00:00Z" };
const token = newPacketToken();

const event = (kind: FactoryEventKind, at: string, over: Partial<FactoryEvent> = {}): FactoryEvent => ({
  id: `event-${at}`,
  packetId: PACKET.packetId,
  kind,
  note: "",
  photoKey: null,
  ordersMoved: 0,
  at,
  ...over,
});

const SOURCES = {
  batch: SAMPLE_BATCH,
  sources: [
    { order: sampleOrder(1), brandName: "Northside Cricket Club", roster: ROSTER_3 },
    { order: sampleOrder(2, { sizes: { XL: 4, M: 2 }, pieces: 6 }), brandName: "Bayside FC", roster: null },
  ],
} as unknown as Awaited<ReturnType<PacketLoadDeps["sources"]>>;

const deps = (over: Partial<PacketLoadDeps> = {}): PacketLoadDeps & { open: ReturnType<typeof vi.fn>; sources: ReturnType<typeof vi.fn> } => {
  const base = {
    open: vi.fn().mockResolvedValue(PACKET),
    sources: vi.fn().mockResolvedValue(SOURCES),
    settings: vi.fn().mockResolvedValue(DEFAULT_OPS_SETTINGS),
    events: vi.fn().mockResolvedValue([]),
  };
  return { ...base, ...over } as PacketLoadDeps & typeof base;
};

describe("loadPacketPage", () => {
  it("reads nothing at all for a token that could never open a packet", async () => {
    const d = deps();

    for (const value of ["", "short", `${token}x`, "../../etc/passwd"]) expect(await loadPacketPage(d, value)).toBeNull();
    expect(d.open).not.toHaveBeenCalled();
    expect(d.sources).not.toHaveBeenCalled();
  });

  it("reads nothing more once the database says the token opens nothing", async () => {
    const d = deps({ open: vi.fn().mockResolvedValue(null) });

    expect(await loadPacketPage(d, token)).toBeNull();
    expect(d.sources).not.toHaveBeenCalled();
  });

  it("reads only the batch the token's packet names, never anything the visitor sent", async () => {
    const d = deps();

    const page = await loadPacketPage(d, token);

    expect(d.sources).toHaveBeenCalledWith(PACKET.batchId);
    expect(page?.packet).toEqual(PACKET);
    expect(page?.batch.id).toBe(SAMPLE_BATCH.id);
  });

  it("builds its lists from the same model as the factory sheet PDF, so the page and the PDF agree", async () => {
    const page = await loadPacketPage(deps(), token);

    expect(page?.sheet.orders.map((o) => o.ref)).toEqual(["STORE-1001", "STORE-1002"]);
    expect(page?.sheet.sizes).toEqual(["L", "M", "XL"]);
    expect(page?.sheet.totals).toEqual({ counts: [1, 4, 4], total: 9 });
    expect(page?.sheet.names[0]?.rows.map((r) => r.number)).toEqual(["7", "10", "22"]);
    expect(page?.sheet.bom.length).toBeGreaterThan(0);
  });

  it("offers Received first when the factory has recorded nothing", async () => {
    const page = await loadPacketPage(deps(), token);

    expect(page?.lastStep).toBeNull();
    expect(page?.nextStep).toBe("received");
  });

  it("offers the one step after the last one recorded, and none once the batch is ready for QC", async () => {
    const after = async (...kinds: FactoryEventKind[]) =>
      loadPacketPage(deps({ events: vi.fn().mockResolvedValue(kinds.map((kind, i) => event(kind, `2026-11-0${i + 1}T09:00:00Z`))) }), token);

    expect((await after("received"))?.nextStep).toBe("in_production");
    expect((await after("received", "note", "photo"))?.nextStep).toBe("in_production");
    expect((await after("received", "in_production"))?.nextStep).toBe("ready_for_qc");
    const done = await after("received", "in_production", "ready_for_qc");
    expect(done?.lastStep).toBe("ready_for_qc");
    expect(done?.nextStep).toBeNull();
  });
});

describe("historyLines", () => {
  it("shows what the factory recorded newest first", () => {
    const lines = historyLines([event("received", "2026-11-01T09:00:00Z"), event("note", "2026-11-02T09:00:00Z", { note: "Yarn arrived." })]);

    expect(lines.map((l) => l.kind)).toEqual(["note", "received"]);
    expect(lines[0]).toMatchObject({ note: "Yarn arrived.", at: "2026-11-02T09:00:00Z" });
  });

  it("says how many orders a step moved on, and names a photo without giving its address away", () => {
    const lines = historyLines([
      event("received", "2026-11-01T09:00:00Z", { ordersMoved: 3 }),
      event("photo", "2026-11-02T09:00:00Z", { photoKey: "job-packets/p/abc.jpg", note: "Line 3" }),
    ]);

    expect(lines.find((l) => l.kind === "received")?.moved).toBe(3);
    expect(JSON.stringify(lines)).not.toContain("job-packets/");
  });

  it("leaves the events it was given untouched", () => {
    const events = [event("received", "2026-11-01T09:00:00Z"), event("note", "2026-11-02T09:00:00Z")];

    historyLines(events);

    expect(events.map((e) => e.kind)).toEqual(["received", "note"]);
    expect(historyLines([])).toEqual([]);
  });
});
