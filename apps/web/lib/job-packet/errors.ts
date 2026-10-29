import { AppError, MESSAGES } from "@/lib/server/core/errors";

export type PacketDatabaseError = Readonly<{ code?: string; hint?: string | null; message: string }>;

/** What a factory or ops person reads when the database refuses, by the hint the job packet functions raise. */
const CONFLICTS: Readonly<Record<string, string>> = {
  packet_exists: "This batch already has a factory link. Send it again or revoke it.",
  packet_revoked: "That factory link was revoked. Make a new one.",
  packet_full: "This link has taken as much as it can. Ask Knitwright for a new one.",
  illegal_step: "The steps go one at a time: Received, In production, Ready for QC.",
  append_only: "What a factory recorded can never be changed or removed.",
};

export const PACKET_NOT_FOUND = "That link does not exist.";

/** A database refusal as a failure people may read. Anything unknown says nothing more. */
export function packetFailure(error: PacketDatabaseError): AppError {
  const conflict = error.hint ? CONFLICTS[error.hint] : undefined;
  if (conflict) return new AppError("conflict", conflict);
  if (error.hint === "invalid_note") return new AppError("invalid_input", "A note has 1 to 1000 characters.", { note: ["A note has 1 to 1000 characters."] });
  switch (error.code) {
    case "P0002":
    case "22P02":
      return new AppError("not_found", PACKET_NOT_FOUND);
    case "22023":
    case "23514":
      return new AppError("invalid_input", MESSAGES.invalid_input);
    default:
      return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  }
}

export const throwIfPacketFailed = (error: PacketDatabaseError | null): void => {
  if (error) throw packetFailure(error);
};
