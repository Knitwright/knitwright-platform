import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The signed service token every Store endpoint asks for (plan v5 O2).
 *
 * The same idiom as the files-service token (`lib/files-service/token.ts`, decision 0070), for the
 * same reason: the caller is a service, not a person. There is no session to check, no cookie, no
 * row in `memberships`. The platform trusts the Store because the Store can sign, and what it signs
 * says which payload is being asked for, with which query, and until when.
 *
 * `v1.<payload>.<expiry>.<digest of the query>`, HMAC-SHA256 with the shared secret. Binding the
 * query means a token caught in a log cannot be replayed to read a different brand's rows, and
 * binding the payload kind means a token for the drops cannot read the products. The secret is
 * `STORE_SERVICE_TOKEN`, it lives only on the server, and it is set in no environment where tests
 * run — so with it unset every endpoint is switched off rather than open, exactly as the weekly
 * cut's route is (decision 0100).
 */

export const TOKEN_HEADER = "x-knitwright-store-token";
export const TOKEN_VERSION = "v1";

/** How long a token is good for. Short, because the Store signs one per call. */
export const TOKEN_LIFETIME_SECONDS = 300;

/** The shortest secret the platform will sign with. A short secret is a misconfiguration, not a choice. */
export const SECRET_MIN_LENGTH = 32;

/**
 * The query, in one line, so the caller and the platform digest the same text. Keys are sorted and
 * a key with no value is left out, so "?limit=50&brandId=x" and "?brandId=x&limit=50" sign alike.
 */
export function canonicalQuery(query: Readonly<Record<string, string | undefined>>): string {
  return Object.entries(query)
    .filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

const digest = (text: string): string => createHmac("sha256", "knitwright-store-query").update(text).digest("hex");

export type SignedToken = Readonly<{ token: string; expiresAt: number }>;

/** Signs one call. `nowSeconds` is passed in, so a test never reads the clock. */
export function signStoreToken(secret: string, payload: string, query: string, nowSeconds: number): SignedToken {
  if (secret.length < SECRET_MIN_LENGTH) throw new Error(`The Store contract needs STORE_SERVICE_TOKEN to be at least ${SECRET_MIN_LENGTH} characters.`);
  const expiresAt = Math.floor(nowSeconds) + TOKEN_LIFETIME_SECONDS;
  const body = `${TOKEN_VERSION}.${payload}.${expiresAt}.${digest(query)}`;
  return { token: `${body}.${createHmac("sha256", secret).update(body).digest("hex")}`, expiresAt };
}

/**
 * Checks a token. The expiry is read before the signature, and the signature is compared in
 * constant time, so a caller learns nothing from how long an answer took.
 */
export function verifyStoreToken(secret: string, token: string, payload: string, query: string, nowSeconds: number): boolean {
  if (secret.length < SECRET_MIN_LENGTH) return false;
  const parts = token.split(".");
  if (parts.length !== 5) return false;
  const [version, kind, expiry, hash, mac] = parts as [string, string, string, string, string];
  if (version !== TOKEN_VERSION || kind !== payload) return false;
  const expiresAt = Number(expiry);
  if (!Number.isInteger(expiresAt) || expiresAt < nowSeconds) return false;
  if (hash !== digest(query)) return false;
  const expected = createHmac("sha256", secret).update(`${version}.${kind}.${expiry}.${hash}`).digest();
  const given = Buffer.from(mac, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
