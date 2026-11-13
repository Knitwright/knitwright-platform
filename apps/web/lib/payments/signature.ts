import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The `Stripe-Signature` header (plan v6 C1, decision 0152), written and checked the way Stripe documents it:
 * `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" under the endpoint secret>`. Several `v1` entries may
 * be present while a secret is rolled; any one matching is enough. A signature older than the tolerance is refused,
 * so a captured request cannot be replayed later.
 *
 * The same code signs the events of the test checkout (`test-provider.ts`), so the one webhook path is exercised in
 * every test and every local run, never a shortcut beside it.
 */

export const SIGNATURE_TOLERANCE_SECONDS = 300;

export type SignatureCheck = Readonly<{ ok: true }> | Readonly<{ ok: false; reason: "missing" | "malformed" | "stale" | "mismatch" }>;

const digest = (secret: string, timestamp: number, payload: string): string =>
  createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");

/** The header Stripe would send for this body at this time. */
export const signatureHeader = (secret: string, payload: string, timestamp: number): string => `t=${timestamp},v1=${digest(secret, timestamp, payload)}`;

type Parts = Readonly<{ timestamp: number | null; signatures: readonly string[] }>;

const partsOf = (header: string): Parts => {
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2).map((text) => text.trim());
    if (key === "t" && value !== undefined && /^\d{1,12}$/.test(value)) timestamp = Number(value);
    if (key === "v1" && value !== undefined && /^[0-9a-f]{64}$/.test(value)) signatures.push(value);
  }
  return { timestamp, signatures };
};

const same = (a: string, b: string): boolean => a.length === b.length && timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));

/** Whether the raw body was signed with the secret within the tolerance of `nowSeconds`. */
export function verifySignature(
  header: string | null,
  payload: string,
  secret: string,
  nowSeconds: number,
  tolerance: number = SIGNATURE_TOLERANCE_SECONDS,
): SignatureCheck {
  if (header === null || header.trim() === "") return { ok: false, reason: "missing" };
  const { timestamp, signatures } = partsOf(header);
  if (timestamp === null || signatures.length === 0) return { ok: false, reason: "malformed" };
  if (Math.abs(nowSeconds - timestamp) > tolerance) return { ok: false, reason: "stale" };
  const expected = digest(secret, timestamp, payload);
  return signatures.some((signature) => same(signature, expected)) ? { ok: true } : { ok: false, reason: "mismatch" };
}
