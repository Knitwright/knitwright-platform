import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The service token the platform signs each files-service call with (decision 0070). It is not a
 * session: the files service trusts the platform, not a person, so the token says which operation
 * is being asked for, over which body, and until when. Binding the body and the operation means a
 * token caught in a log cannot be replayed as a different, more expensive call.
 *
 * HMAC-SHA256 over `v1.<operation>.<expiry>.<sha256 of the body>` with the shared secret. The
 * secret is `FILES_SERVICE_TOKEN` and never leaves the server.
 */

export const TOKEN_HEADER = "x-knitwright-service-token";
export const TOKEN_VERSION = "v1";

/** How long a token is good for. Short, because the platform signs one per call. */
export const TOKEN_LIFETIME_SECONDS = 120;

const sha256 = (body: string): string => createHmac("sha256", "knitwright-files-body").update(body).digest("hex");

export type SignedToken = Readonly<{ token: string; expiresAt: number }>;

/** Signs one call. `nowSeconds` is passed in, so a test never reads the clock. */
export function signServiceToken(secret: string, operation: string, body: string, nowSeconds: number): SignedToken {
  if (secret === "") throw new Error("The files service needs FILES_SERVICE_TOKEN to be set.");
  const expiresAt = Math.floor(nowSeconds) + TOKEN_LIFETIME_SECONDS;
  const payload = `${TOKEN_VERSION}.${operation}.${expiresAt}.${sha256(body)}`;
  const mac = createHmac("sha256", secret).update(payload).digest("hex");
  return { token: `${payload}.${mac}`, expiresAt };
}

/**
 * Checks a token the way the files service will, so the platform's tests prove the format. The
 * comparison is constant-time and the expiry is checked before the signature.
 */
export function verifyServiceToken(secret: string, token: string, operation: string, body: string, nowSeconds: number): boolean {
  const parts = token.split(".");
  if (parts.length !== 5) return false;
  const [version, op, expiry, hash, mac] = parts;
  if (version !== TOKEN_VERSION || op !== operation) return false;
  const expiresAt = Number(expiry);
  if (!Number.isInteger(expiresAt) || expiresAt < nowSeconds) return false;
  if (hash !== sha256(body)) return false;
  const expected = createHmac("sha256", secret).update(`${version}.${op}.${expiry}.${hash}`).digest();
  const given = Buffer.from(mac, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
