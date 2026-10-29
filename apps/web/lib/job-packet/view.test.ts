import { describe, expect, it } from "vitest";
import type { PacketSummary } from "./service";
import { livePacket, packetState, packetStateLine, sentLine } from "./view";

const NOW = new Date("2026-11-10T12:00:00Z");

const packet = (over: Partial<PacketSummary> = {}): PacketSummary => ({
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-11-01T09:00:00Z",
  expiresAt: "2026-11-29T09:00:00Z",
  revokedAt: null,
  sentCount: 1,
  lastSentAt: "2026-11-01T09:00:00Z",
  ...over,
});

describe("packetState", () => {
  it("is open while the link still works", () => {
    expect(packetState(packet(), NOW)).toBe("open");
  });

  it("is expired once its day has passed, and at the very moment it passes", () => {
    expect(packetState(packet({ expiresAt: "2026-11-09T09:00:00Z" }), NOW)).toBe("expired");
    expect(packetState(packet({ expiresAt: NOW.toISOString() }), NOW)).toBe("expired");
  });

  it("is revoked whatever the expiry says, so a revoked link is never shown as open", () => {
    expect(packetState(packet({ revokedAt: "2026-11-05T09:00:00Z" }), NOW)).toBe("revoked");
    expect(packetState(packet({ revokedAt: "2026-11-05T09:00:00Z", expiresAt: "2027-01-01T09:00:00Z" }), NOW)).toBe("revoked");
  });
});

describe("packetStateLine", () => {
  it("says until when an open link works", () => {
    expect(packetStateLine(packet(), NOW)).toBe("Open until 29 Nov 2026, 09:00 UTC");
  });

  it("says when an expired link stopped and when a revoked one was revoked", () => {
    expect(packetStateLine(packet({ expiresAt: "2026-11-09T09:00:00Z" }), NOW)).toBe("Expired 9 Nov 2026, 09:00 UTC");
    expect(packetStateLine(packet({ revokedAt: "2026-11-05T08:30:00Z" }), NOW)).toBe("Revoked 5 Nov 2026, 08:30 UTC");
  });
});

describe("sentLine", () => {
  it("counts in words, singular for the first time", () => {
    expect(sentLine(packet())).toBe("Sent 1 time, last 1 Nov 2026, 09:00 UTC");
    expect(sentLine(packet({ sentCount: 3, lastSentAt: "2026-11-08T14:05:00Z" }))).toBe("Sent 3 times, last 8 Nov 2026, 14:05 UTC");
  });
});

describe("livePacket", () => {
  it("is the one packet that has not been revoked, expired or not", () => {
    const open = packet({ id: "22222222-2222-4222-8222-222222222222" });
    const revoked = packet({ revokedAt: "2026-11-05T09:00:00Z" });
    const stale = packet({ id: "33333333-3333-4333-8333-333333333333", expiresAt: "2026-11-01T09:00:00Z" });

    expect(livePacket([revoked, open])?.id).toBe(open.id);
    expect(livePacket([revoked, stale])?.id).toBe(stale.id);
  });

  it("is nothing when every packet was revoked, so ops is offered a new one", () => {
    expect(livePacket([])).toBeNull();
    expect(livePacket([packet({ revokedAt: "2026-11-05T09:00:00Z" })])).toBeNull();
  });
});

describe("a link revoked on the day it would have expired anyway", () => {
  it("is still read as revoked, so the line never says it merely ran out", () => {
    const same = packet({ revokedAt: "2026-11-09T09:00:00Z", expiresAt: "2026-11-09T09:00:00Z" });

    expect(packetState(same, NOW)).toBe("revoked");
    expect(packetStateLine(same, NOW)).toBe("Revoked 9 Nov 2026, 09:00 UTC");
  });
});
