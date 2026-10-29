import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { throwIfPacketFailed } from "./errors";
import { FACTORY_EVENT_KINDS, type FactoryEventKind } from "./steps";
import { isPacketToken } from "./token";

/**
 * Job packets in the database (decision 0072). Every write, and every read made with a token, goes through the
 * job packet functions, which only the server's own key may run. Ops writes name the actor, and the database
 * checks the actor is a platform admin. A token is checked for shape before it reaches the database.
 */

type Rpc = Pick<SupabaseClient, "rpc">;

const issuedRow = z.object({ id: z.uuid(), expires_at: z.string() });

export interface IssuedPacket {
  readonly id: string;
  readonly expiresAt: string;
}

const firstRow = (data: unknown): unknown => (Array.isArray(data) ? data[0] : data);

const issued = (data: unknown): IssuedPacket => {
  const row = issuedRow.parse(firstRow(data));
  return { id: row.id, expiresAt: row.expires_at };
};

export async function createPacket(admin: Rpc, input: Readonly<{ actor: string; batchId: string; token: string; days: number }>): Promise<IssuedPacket> {
  const { data, error } = await admin.rpc("create_job_packet", { p_actor: input.actor, p_batch_id: input.batchId, p_token: input.token, p_days: input.days });
  throwIfPacketFailed(error);
  return issued(data);
}

/** Gives the packet a new token and expiry. The old address opens nothing from now on. */
export async function resendPacket(
  admin: Rpc,
  input: Readonly<{ actor: string; batchId: string; packetId: string; token: string; days: number }>,
): Promise<IssuedPacket> {
  const { data, error } = await admin.rpc("resend_job_packet", {
    p_actor: input.actor,
    p_batch_id: input.batchId,
    p_packet_id: input.packetId,
    p_token: input.token,
    p_days: input.days,
  });
  throwIfPacketFailed(error);
  return issued(data);
}

export async function revokePacket(admin: Rpc, input: Readonly<{ actor: string; batchId: string; packetId: string }>): Promise<void> {
  const { error } = await admin.rpc("revoke_job_packet", { p_actor: input.actor, p_batch_id: input.batchId, p_packet_id: input.packetId });
  throwIfPacketFailed(error);
}

export interface OpenPacket {
  readonly packetId: string;
  readonly batchId: string;
  readonly expiresAt: string;
}

const openRow = z.object({ packet_id: z.uuid(), batch_id: z.uuid(), expires_at: z.string() });

/** The packet a token opens, or null for a token that is malformed, unknown, expired or revoked. */
export async function openPacket(admin: Rpc, token: string): Promise<OpenPacket | null> {
  if (!isPacketToken(token)) return null;
  const { data, error } = await admin.rpc("open_job_packet", { p_token: token });
  throwIfPacketFailed(error);
  const row = z.array(openRow).parse(data ?? [])[0];
  return row ? { packetId: row.packet_id, batchId: row.batch_id, expiresAt: row.expires_at } : null;
}

export interface RecordInput {
  readonly token: string;
  readonly kind: FactoryEventKind;
  readonly note: string;
  readonly photoKey: string | null;
}

const recordedRow = z.object({ event_id: z.uuid(), at: z.string(), orders_moved: z.number().int() });

export interface Recorded {
  readonly eventId: string;
  readonly at: string;
  readonly ordersMoved: number;
}

/** Keeps what the factory pressed, wrote or photographed. A step moves the batch's orders on. */
export async function recordFactoryEvent(admin: Rpc, input: RecordInput): Promise<Recorded> {
  const { data, error } = await admin.rpc("job_packet_record", { p_token: input.token, p_kind: input.kind, p_note: input.note, p_photo_key: input.photoKey });
  throwIfPacketFailed(error);
  const row = recordedRow.parse(firstRow(data));
  return { eventId: row.event_id, at: row.at, ordersMoved: row.orders_moved };
}

const eventRow = z.object({
  id: z.uuid(),
  packet_id: z.uuid(),
  kind: z.enum(FACTORY_EVENT_KINDS),
  note: z.string(),
  photo_keys: z.array(z.string()),
  orders_moved: z.number().int(),
  at: z.string(),
});

export interface FactoryEvent {
  readonly id: string;
  readonly packetId: string;
  readonly kind: FactoryEventKind;
  readonly note: string;
  readonly photoKey: string | null;
  readonly ordersMoved: number;
  readonly at: string;
}

const EVENTS_LISTED = 500;

const toEvent = (r: z.infer<typeof eventRow>): FactoryEvent => ({ id: r.id, packetId: r.packet_id, kind: r.kind, note: r.note, photoKey: r.photo_keys[0] ?? null, ordersMoved: r.orders_moved, at: r.at });

/** A batch's factory events, oldest first. Read with the server's key for the factory, or a platform admin's own client. */
export async function listFactoryEvents(client: Pick<SupabaseClient, "from">, batchId: string): Promise<readonly FactoryEvent[]> {
  const { data, error } = await client
    .from("factory_events")
    .select("id, packet_id, kind, note, photo_keys, orders_moved, at")
    .eq("batch_id", batchId)
    .order("at")
    .order("id")
    .limit(EVENTS_LISTED);
  throwIfPacketFailed(error);
  return z
    .array(eventRow)
    .parse(data ?? [])
    .map(toEvent);
}

const packetRow = z.object({
  id: z.uuid(),
  created_at: z.string(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
  sent_count: z.number().int(),
  last_sent_at: z.string(),
});

export interface PacketSummary {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly sentCount: number;
  readonly lastSentAt: string;
}

/** A batch's packets, newest first, read as a platform admin. */
export async function listPackets(client: Pick<SupabaseClient, "from">, batchId: string): Promise<readonly PacketSummary[]> {
  const { data, error } = await client
    .from("job_packets")
    .select("id, created_at, expires_at, revoked_at, sent_count, last_sent_at")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: false })
    .limit(20);
  throwIfPacketFailed(error);
  return z
    .array(packetRow)
    .parse(data ?? [])
    .map((r) => ({ id: r.id, createdAt: r.created_at, expiresAt: r.expires_at, revokedAt: r.revoked_at, sentCount: r.sent_count, lastSentAt: r.last_sent_at }));
}

/** One factory event, for ops to see its photo. */
export async function loadFactoryEvent(client: Pick<SupabaseClient, "from">, eventId: string): Promise<FactoryEvent | null> {
  const { data, error } = await client.from("factory_events").select("id, packet_id, kind, note, photo_keys, orders_moved, at").eq("id", eventId).maybeSingle();
  throwIfPacketFailed(error);
  if (!data) return null;
  return toEvent(eventRow.parse(data));
}
