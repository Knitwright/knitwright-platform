import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * The token in an unsubscribe link. It names one person and is signed by the server, so the
 * link works without signing in and nobody can unsubscribe someone else by guessing.
 * It follows the proposal tokens (lib/intent/proposal-token.ts) with a key of its own.
 *
 * It never runs out: the Spam Act wants an unsubscribe that works for at least 30 days after
 * a message is sent, and a link that still works later does no harm. All it can do is stop
 * marketing email to the person it names.
 */

const MAX_TOKEN_LENGTH = 512;
const INVALID = "That unsubscribe link could not be checked. Sign in and change your email choice in Settings.";

/** A signing key of its own, derived from a server secret, so the secret itself is never used to sign. */
export const unsubscribeKey = (secret: string): Buffer => createHmac("sha256", secret).update("knitwright unsubscribe signing v1").digest();

const mac = (key: Buffer, payload: string): Buffer => createHmac("sha256", key).update(payload).digest();

const payloadSchema = z.strictObject({ u: z.string().min(1).max(64), p: z.literal("marketing_email") });

export const signUnsubscribe = (userId: string, key: Buffer): string => {
  const payload = Buffer.from(JSON.stringify({ u: userId, p: "marketing_email" })).toString("base64url");
  return `${payload}.${mac(key, payload).toString("base64url")}`;
};

export type VerifiedUnsubscribe = { readonly ok: true; readonly userId: string } | { readonly ok: false; readonly reason: string };

export const verifyUnsubscribe = (token: string, key: Buffer): VerifiedUnsubscribe => {
  const parts = token.length <= MAX_TOKEN_LENGTH ? token.split(".") : [];
  if (parts.length !== 2) return { ok: false, reason: INVALID };
  const [payload, signature] = parts;
  const expected = mac(key, payload);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: INVALID };
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    return parsed.success ? { ok: true, userId: parsed.data.u } : { ok: false, reason: INVALID };
  } catch {
    return { ok: false, reason: INVALID };
  }
};

/** The address to put in a marketing email: the confirm page on this site. */
export const unsubscribeUrl = (siteUrl: string, token: string): string => {
  const url = new URL("/unsubscribe", siteUrl);
  url.searchParams.set("token", token);
  return url.toString();
};
