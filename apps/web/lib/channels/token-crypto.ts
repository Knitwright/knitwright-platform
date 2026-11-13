import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * A shop's access token at rest (plan v6 C4, decision 0155): AES-256-GCM under CHANNEL_TOKEN_KEY, with a fresh
 * 12-byte nonce each time and the shop's own domain as additional data, so a ciphertext copied onto another
 * shop's row does not open. Only the ciphertext (with its tag) and the nonce are stored; the token itself is never
 * written to the database or a log.
 *
 * Where no key is configured (tests, a local run, CI) the key is derived from the server's secret key; the
 * environment check refuses a deploy that has a Shopify app but no CHANNEL_TOKEN_KEY.
 */

export type Sealed = Readonly<{ ciphertext: string; nonce: string }>;

const NONCE_BYTES = 12;
const TAG_BYTES = 16;

/** The 32-byte key: CHANNEL_TOKEN_KEY's hex, or a hash of the server key labelled for this one purpose. */
export function tokenKey(configured: string | undefined, serverKey: string): Buffer {
  if (configured !== undefined) {
    if (!/^[0-9a-fA-F]{64}$/.test(configured)) throw new Error("CHANNEL_TOKEN_KEY must be 64 hex characters.");
    return Buffer.from(configured, "hex");
  }
  return createHash("sha256").update(`knitwright-channel-token:${serverKey}`, "utf8").digest();
}

export function sealToken(key: Buffer, token: string, shop: string, nonce: Buffer = randomBytes(NONCE_BYTES)): Sealed {
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(shop, "utf8"));
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return { ciphertext: body.toString("base64"), nonce: nonce.toString("base64") };
}

/** The token, or null when the ciphertext was not made with this key for this shop. */
export function openToken(key: Buffer, sealed: Sealed, shop: string): string | null {
  try {
    const body = Buffer.from(sealed.ciphertext, "base64");
    const nonce = Buffer.from(sealed.nonce, "base64");
    if (nonce.length !== NONCE_BYTES || body.length <= TAG_BYTES) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(Buffer.from(shop, "utf8"));
    decipher.setAuthTag(body.subarray(body.length - TAG_BYTES));
    return Buffer.concat([decipher.update(body.subarray(0, body.length - TAG_BYTES)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
