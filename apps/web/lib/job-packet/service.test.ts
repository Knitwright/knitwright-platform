import { describe, expect, it, vi } from "vitest";
import { PACKET_NOT_FOUND } from "./errors";
import {
  createPacket,
  listFactoryEvents,
  listPackets,
  loadFactoryEvent,
  openPacket,
  recordFactoryEvent,
  resendPacket,
  revokePacket,
} from "./service";
import { newPacketToken } from "./token";

const PACKET = "11111111-1111-4111-8111-111111111111";
const BATCH = "22222222-2222-4222-8222-222222222222";
const EVENT = "33333333-3333-4333-8333-333333333333";
const token = newPacketToken();

const rpcOf = (data: unknown, error: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error }) });

/** A Supabase query chain that ends in the rows given, recording what was asked for. */
const fromOf = (data: unknown, error: unknown = null) => {
  const calls: Record<string, unknown[]> = {};
  const chain: Record<string, unknown> = {};
  for (const name of ["select", "eq", "order", "limit"]) {
    chain[name] = (...args: unknown[]) => {
      calls[name] = [...(calls[name] ?? []), ...args];
      return chain;
    };
  }
  chain.then = (resolve: (value: unknown) => unknown) => resolve({ data, error });
  chain.maybeSingle = async () => ({ data, error });
  const from = vi.fn().mockReturnValue(chain);
  return { client: { from }, from, calls };
};

describe("createPacket", () => {
  it("hands the token to the database and gives back the link's id and expiry", async () => {
    const admin = rpcOf([{ id: PACKET, expires_at: "2026-11-29T09:00:00Z" }]);

    expect(await createPacket(admin, { actor: "a", batchId: BATCH, token, days: 28 })).toEqual({ id: PACKET, expiresAt: "2026-11-29T09:00:00Z" });
    expect(admin.rpc).toHaveBeenCalledWith("create_job_packet", { p_actor: "a", p_batch_id: BATCH, p_token: token, p_days: 28 });
  });

  it("tells ops the batch already has a link rather than making a second one", async () => {
    const admin = rpcOf(null, { code: "P0001", hint: "packet_exists", message: "x" });

    await expect(createPacket(admin, { actor: "a", batchId: BATCH, token, days: 28 })).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("resendPacket", () => {
  it("names the batch as well as the link, so the renewal is tied to the page ops is on", async () => {
    const admin = rpcOf({ id: PACKET, expires_at: "2026-12-01T09:00:00Z" });

    expect(await resendPacket(admin, { actor: "a", batchId: BATCH, packetId: PACKET, token, days: 14 })).toEqual({ id: PACKET, expiresAt: "2026-12-01T09:00:00Z" });
    expect(admin.rpc).toHaveBeenCalledWith("resend_job_packet", { p_actor: "a", p_batch_id: BATCH, p_packet_id: PACKET, p_token: token, p_days: 14 });
  });

  it("says a revoked link cannot be sent again", async () => {
    const admin = rpcOf(null, { code: "P0001", hint: "packet_revoked", message: "x" });

    await expect(resendPacket(admin, { actor: "a", batchId: BATCH, packetId: PACKET, token, days: 14 })).rejects.toMatchObject({
      code: "conflict",
      message: "That factory link was revoked. Make a new one.",
    });
  });
});

describe("revokePacket", () => {
  it("names the batch and the link and answers nothing", async () => {
    const admin = rpcOf(null);

    expect(await revokePacket(admin, { actor: "a", batchId: BATCH, packetId: PACKET })).toBeUndefined();
    expect(admin.rpc).toHaveBeenCalledWith("revoke_job_packet", { p_actor: "a", p_batch_id: BATCH, p_packet_id: PACKET });
  });

  it("says the link does not exist when it belongs to another batch", async () => {
    const admin = rpcOf(null, { code: "P0002", message: "That factory link does not exist." });

    await expect(revokePacket(admin, { actor: "a", batchId: BATCH, packetId: PACKET })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("openPacket", () => {
  it("does not ask the database about a token that could never open a packet", async () => {
    const admin = { rpc: vi.fn() };

    for (const value of ["", "short", `${token}x`, "../../etc/passwd"]) expect(await openPacket(admin, value)).toBeNull();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("gives the packet and its batch for a token that opens one", async () => {
    const admin = rpcOf([{ packet_id: PACKET, batch_id: BATCH, expires_at: "2026-11-29T09:00:00Z" }]);

    expect(await openPacket(admin, token)).toEqual({ packetId: PACKET, batchId: BATCH, expiresAt: "2026-11-29T09:00:00Z" });
    expect(admin.rpc).toHaveBeenCalledWith("open_job_packet", { p_token: token });
  });

  it("gives nothing for a token that is unknown, expired or revoked: the database tells the three apart, the server does not", async () => {
    expect(await openPacket(rpcOf([]), token)).toBeNull();
    expect(await openPacket(rpcOf(null), token)).toBeNull();
  });
});

describe("recordFactoryEvent", () => {
  it("keeps what the factory pressed and says how many orders moved on", async () => {
    const admin = rpcOf([{ event_id: EVENT, at: "2026-11-10T12:00:00Z", orders_moved: 2 }]);

    expect(await recordFactoryEvent(admin, { token, kind: "received", note: "", photoKey: null })).toEqual({
      eventId: EVENT,
      at: "2026-11-10T12:00:00Z",
      ordersMoved: 2,
    });
    expect(admin.rpc).toHaveBeenCalledWith("job_packet_record", { p_token: token, p_kind: "received", p_note: "", p_photo_key: null });
  });

  it("passes a photo's key through unchanged, so the database can check it belongs to the packet", async () => {
    const admin = rpcOf({ event_id: EVENT, at: "2026-11-10T12:00:00Z", orders_moved: 0 });
    const photoKey = `job-packets/${PACKET}/44444444-4444-4444-8444-444444444444.jpg`;

    await recordFactoryEvent(admin, { token, kind: "photo", note: "Line 3", photoKey });

    expect(admin.rpc.mock.calls[0]![1]).toMatchObject({ p_photo_key: photoKey });
  });

  it("turns a step out of turn into words the factory can act on", async () => {
    const admin = rpcOf(null, { code: "P0001", hint: "illegal_step", message: "x" });

    await expect(recordFactoryEvent(admin, { token, kind: "ready_for_qc", note: "", photoKey: null })).rejects.toMatchObject({
      code: "conflict",
      message: "The steps go one at a time: Received, In production, Ready for QC.",
    });
  });

  it("says the link does not exist when the token no longer opens one", async () => {
    const admin = rpcOf(null, { code: "P0002", message: "That link does not exist." });

    await expect(recordFactoryEvent(admin, { token, kind: "note", note: "hello", photoKey: null })).rejects.toMatchObject({
      code: "not_found",
      message: PACKET_NOT_FOUND,
    });
  });
});

describe("listFactoryEvents", () => {
  it("reads one batch's events, oldest first, and keeps only the first photo key", async () => {
    const { client, from, calls } = fromOf([
      { id: EVENT, packet_id: PACKET, kind: "photo", note: "Line 3", photo_keys: ["a.jpg", "b.jpg"], orders_moved: 0, at: "2026-11-10T12:00:00Z" },
    ]);

    const events = await listFactoryEvents(client, BATCH);

    expect(events).toEqual([{ id: EVENT, packetId: PACKET, kind: "photo", note: "Line 3", photoKey: "a.jpg", ordersMoved: 0, at: "2026-11-10T12:00:00Z" }]);
    expect(from).toHaveBeenCalledWith("factory_events");
    expect(calls.eq).toEqual(["batch_id", BATCH]);
    expect(calls.order).toEqual(["at", "id"]);
    expect(calls.limit?.[0]).toBe(500);
  });

  it("gives an empty list when there is nothing, and null for an event with no photo", async () => {
    expect(await listFactoryEvents(fromOf(null).client, BATCH)).toEqual([]);
    const one = await listFactoryEvents(fromOf([{ id: EVENT, packet_id: PACKET, kind: "note", note: "n", photo_keys: [], orders_moved: 0, at: "2026-11-10T12:00:00Z" }]).client, BATCH);
    expect(one[0]?.photoKey).toBeNull();
  });

  it("raises what the database said when the read is refused", async () => {
    await expect(listFactoryEvents(fromOf(null, { code: "42501", message: "denied" }).client, BATCH)).rejects.toMatchObject({ code: "internal" });
  });

  it("refuses a row whose kind is not one a factory can record", async () => {
    const { client } = fromOf([{ id: EVENT, packet_id: PACKET, kind: "shipped", note: "", photo_keys: [], orders_moved: 0, at: "2026-11-10T12:00:00Z" }]);

    await expect(listFactoryEvents(client, BATCH)).rejects.toThrow();
  });
});

describe("listPackets", () => {
  it("reads one batch's links, newest first", async () => {
    const { client, from, calls } = fromOf([
      { id: PACKET, created_at: "2026-11-01T09:00:00Z", expires_at: "2026-11-29T09:00:00Z", revoked_at: null, sent_count: 2, last_sent_at: "2026-11-08T09:00:00Z" },
    ]);

    expect(await listPackets(client, BATCH)).toEqual([
      { id: PACKET, createdAt: "2026-11-01T09:00:00Z", expiresAt: "2026-11-29T09:00:00Z", revokedAt: null, sentCount: 2, lastSentAt: "2026-11-08T09:00:00Z" },
    ]);
    expect(from).toHaveBeenCalledWith("job_packets");
    expect(calls.order).toEqual(["created_at", { ascending: false }]);
  });

  it("gives an empty list when the batch has none", async () => {
    expect(await listPackets(fromOf(null).client, BATCH)).toEqual([]);
    expect(await listPackets(fromOf([]).client, BATCH)).toEqual([]);
  });

  it("never reads a token hash into the page", async () => {
    const { calls } = fromOf([]);
    await listPackets(fromOf([]).client, BATCH);

    expect(JSON.stringify(calls.select ?? [])).not.toContain("token");
  });
});

describe("loadFactoryEvent", () => {
  it("gives one event for ops, or nothing when the id names none", async () => {
    const row = { id: EVENT, packet_id: PACKET, kind: "photo", note: "", photo_keys: ["a.jpg"], orders_moved: 0, at: "2026-11-10T12:00:00Z" };

    expect(await loadFactoryEvent(fromOf(row).client, EVENT)).toMatchObject({ id: EVENT, photoKey: "a.jpg" });
    expect(await loadFactoryEvent(fromOf(null).client, EVENT)).toBeNull();
  });

  it("raises what the database said when the read is refused", async () => {
    await expect(loadFactoryEvent(fromOf(null, { code: "42501", message: "denied" }).client, EVENT)).rejects.toMatchObject({ code: "internal" });
  });
});
