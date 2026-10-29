import { formatDateTime } from "@/lib/projects/dates";
import type { PacketSummary } from "./service";

/**
 * How ops reads a batch's factory link. The time is given in, never read here, so the sentence a page shows is
 * decided by a pure function the tests can pin.
 */

export type PacketState = "open" | "expired" | "revoked";

export const packetState = (packet: Readonly<{ expiresAt: string; revokedAt: string | null }>, now: Date): PacketState =>
  packet.revokedAt !== null ? "revoked" : Date.parse(packet.expiresAt) <= now.getTime() ? "expired" : "open";

/** The sentence beside the link: whether it still works, and until or since when. */
export function packetStateLine(packet: PacketSummary, now: Date): string {
  if (packet.revokedAt !== null) return `Revoked ${formatDateTime(packet.revokedAt)}`;
  return packetState(packet, now) === "expired" ? `Expired ${formatDateTime(packet.expiresAt)}` : `Open until ${formatDateTime(packet.expiresAt)}`;
}

/** How often the link has been sent, in words, for the line beside it. */
export const sentLine = (packet: PacketSummary): string =>
  `Sent ${packet.sentCount} ${packet.sentCount === 1 ? "time" : "times"}, last ${formatDateTime(packet.lastSentAt)}`;

/** The packet ops may send again or revoke: the one that has not been revoked, expired or not. */
export const livePacket = (packets: readonly PacketSummary[]): PacketSummary | null => packets.find((p) => p.revokedAt === null) ?? null;
