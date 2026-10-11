import { createHash, randomBytes } from "node:crypto";

/**
 * Share tokens and visitor keys. A token is the secret part of a share link: 256 random bits,
 * shown to the member once and never stored (the database keeps its hash). A visitor key is the
 * random value in a visitor's cookie, so one browser keeps one answer per link.
 */

const KEY_BYTES = 32;
const KEY_SHAPE = /^[A-Za-z0-9_-]{43}$/;

const randomKey = (): string => randomBytes(KEY_BYTES).toString("base64url");

/** A new share token. */
export const newShareToken = randomKey;

/** True for text shaped like a token the server makes. Anything else can open nothing. */
export const isShareToken = (value: unknown): value is string => typeof value === "string" && KEY_SHAPE.test(value);

/** A new visitor key. */
export const newVisitorKey = randomKey;

export const isVisitorKey = (value: unknown): value is string => typeof value === "string" && KEY_SHAPE.test(value);

/** The cookie that holds a visitor's key. */
export const SHARE_VISITOR_COOKIE = "kw_share_visitor";

const NINETY_DAYS_IN_SECONDS = 60 * 60 * 24 * 90;

/** Hidden from scripts, sent only to share pages, and kept as long as the longest link lasts. */
export const visitorCookieOptions = (siteUrl: string) => ({
  httpOnly: true as const,
  secure: new URL(siteUrl).protocol === "https:",
  sameSite: "lax" as const,
  path: "/s",
  maxAge: NINETY_DAYS_IN_SECONDS,
});

/** The address a member copies and sends to their committee. */
export const shareAddress = (siteUrl: string, token: string): string => `${siteUrl.replace(/\/+$/, "")}/s/${token}`;

/** Names one link in the rate limit table without writing its token there. */
export const linkRateKey = (token: string): string => createHash("sha256").update(token, "utf8").digest("hex");
