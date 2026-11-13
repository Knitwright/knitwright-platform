import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SHOPIFY_SCOPES } from "./admin";
import { verifyQuery, shopDomain } from "./hmac";

/**
 * Shopify's OAuth install (plan v6 C4, decision 0155).
 *
 * 1. A member presses Connect: we make a random `state`, put it with the brand, the person and an expiry in a
 *    cookie signed with the app secret, and send the browser to Shopify's authorise page (offline access: the
 *    token outlives the session, which webhooks and tracking need).
 * 2. Shopify sends the browser back with `code`, `shop`, `state`, `timestamp` and `hmac`. The return is accepted
 *    only when the hmac is Shopify's, the shop is a myshopify domain, the state is the cookie's, the cookie is
 *    ours, unexpired, and names the same person and brand as the session.
 */

export const STATE_COOKIE = "kw_shopify_state";
export const STATE_SECONDS = 10 * 60;
export const CALLBACK_PATH = "/api/channels/shopify/callback";

export type InstallState = Readonly<{ nonce: string; brandId: string; userId: string; shop: string; expires: number }>;

const sign = (secret: string, payload: string): string => createHmac("sha256", secret).update(`state:${payload}`, "utf8").digest("base64url");

export function newState(input: Omit<InstallState, "nonce" | "expires">, nowSeconds: number, nonce: string = randomBytes(18).toString("base64url")): InstallState {
  return { ...input, nonce, expires: nowSeconds + STATE_SECONDS };
}

/** The cookie's value: the state as base64url JSON, a dot, and its signature. */
export function stateCookie(secret: string, state: InstallState): string {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${payload}.${sign(secret, payload)}`;
}

export function readStateCookie(secret: string, value: string | undefined, nowSeconds: number): InstallState | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(secret, payload);
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as InstallState;
    return typeof state.expires === "number" && state.expires >= nowSeconds ? state : null;
  } catch {
    return null;
  }
}

/** The authorise page's query. */
export function authorizeQuery(apiKey: string, redirectUri: string, state: string): string {
  return new URLSearchParams({ client_id: apiKey, scope: SHOPIFY_SCOPES.join(","), redirect_uri: redirectUri, state }).toString();
}

export type ReturnCheck =
  | Readonly<{ ok: true; shop: string; code: string; state: InstallState }>
  | Readonly<{ ok: false; reason: "signature" | "shop" | "state" | "person" }>;

/** Checks Shopify's return against the cookie and the session, in that order. */
export function checkReturn(
  secret: string,
  query: Readonly<Record<string, string>>,
  cookie: string | undefined,
  session: Readonly<{ userId: string; brandId: string }>,
  nowSeconds: number,
): ReturnCheck {
  if (!verifyQuery(secret, query)) return { ok: false, reason: "signature" };
  const shop = shopDomain(query.shop ?? "");
  if (shop === null || shop !== query.shop || !query.code) return { ok: false, reason: "shop" };
  const state = readStateCookie(secret, cookie, nowSeconds);
  if (state === null || state.nonce !== query.state || state.shop !== shop) return { ok: false, reason: "state" };
  if (state.userId !== session.userId || state.brandId !== session.brandId) return { ok: false, reason: "person" };
  return { ok: true, shop, code: query.code, state };
}
