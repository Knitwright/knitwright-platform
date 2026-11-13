import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Shopify's two signatures (plan v6 C4, decision 0155), checked the way Shopify documents them, with the app's
 * client secret:
 *
 * - the OAuth return and an app launch carry `hmac` in the query: hex HMAC-SHA256 of every other parameter, sorted
 *   by name and joined as `name=value&...`;
 * - a webhook (and the fulfilment-service callback) carries `X-Shopify-Hmac-Sha256`: base64 HMAC-SHA256 of the
 *   raw body.
 *
 * Both compare in constant time. Nothing from a request is trusted until one of these has passed.
 */

const same = (a: string, b: string): boolean => {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
};

/** The message Shopify signs for a query: every parameter but `hmac` and `signature`, sorted, `k=v` joined by `&`. */
export function queryMessage(params: Readonly<Record<string, string>>): string {
  return Object.keys(params)
    .filter((key) => key !== "hmac" && key !== "signature")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

export const signQuery = (secret: string, params: Readonly<Record<string, string>>): string =>
  createHmac("sha256", secret).update(queryMessage(params), "utf8").digest("hex");

/** Whether a query's `hmac` is the app's own signature of the rest of it. */
export function verifyQuery(secret: string, params: Readonly<Record<string, string>>): boolean {
  const given = params.hmac;
  if (typeof given !== "string" || !/^[0-9a-f]{64}$/i.test(given)) return false;
  return same(given.toLowerCase(), signQuery(secret, params));
}

export const signBody = (secret: string, raw: string): string => createHmac("sha256", secret).update(raw, "utf8").digest("base64");

/** Whether a webhook's raw body was signed with the app's secret. */
export function verifyBody(secret: string, raw: string, header: string | null): boolean {
  if (header === null || !/^[A-Za-z0-9+/]{43}=$/.test(header.trim())) return false;
  return same(header.trim(), signBody(secret, raw));
}

/** A shop's own domain, `name.myshopify.com`, from what a person typed or Shopify sent. Null when it is not one. */
export function shopDomain(input: string): string | null {
  const bare = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const full = bare.includes(".") ? bare : `${bare}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/.test(full) ? full : null;
}
