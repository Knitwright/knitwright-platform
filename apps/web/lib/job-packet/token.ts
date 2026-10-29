import { createHash, randomBytes } from "node:crypto";

/**
 * Job packet tokens (decision 0072). A token is the secret part of a factory's link: 256 random bits, shown to
 * ops once and sent to the factory, never stored (the database keeps its SHA-256 hash). The shape is the same as
 * a share token, so the database checks both the same way.
 */

const TOKEN_BYTES = 32;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** A new job packet token. */
export const newPacketToken = (): string => randomBytes(TOKEN_BYTES).toString("base64url");

/** True for text shaped like a token the server makes. Anything else opens nothing and never reaches the database. */
export const isPacketToken = (value: unknown): value is string => typeof value === "string" && TOKEN_SHAPE.test(value);

/** The hash the database stores and looks a token up by: SHA-256 of its UTF-8 text, as `private.job_packet_hash`. */
export const packetTokenHash = (token: string): Buffer => createHash("sha256").update(token, "utf8").digest();

/** Names one packet in the rate limit table without writing its token there. */
export const packetRateKey = (token: string): string => packetTokenHash(token).toString("hex");

/** The address ops sends to the factory. */
export const packetAddress = (siteUrl: string, token: string): string => `${siteUrl.replace(/\/+$/, "")}/job/${token}`;
