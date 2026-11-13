import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signatureHeader, verifySignature } from "./signature";

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
const NOW = 1_800_000_000;

describe("the Stripe-Signature header", () => {
  it("is Stripe's own scheme: an HMAC-SHA256 of the time and the raw body", () => {
    const expected = createHmac("sha256", SECRET).update(`${NOW}.${BODY}`).digest("hex");
    expect(signatureHeader(SECRET, BODY, NOW)).toBe(`t=${NOW},v1=${expected}`);
  });

  it("accepts a body signed with the secret, a little early or late", () => {
    const header = signatureHeader(SECRET, BODY, NOW);
    expect(verifySignature(header, BODY, SECRET, NOW)).toEqual({ ok: true });
    expect(verifySignature(header, BODY, SECRET, NOW + 299)).toEqual({ ok: true });
    expect(verifySignature(header, BODY, SECRET, NOW - 299)).toEqual({ ok: true });
  });

  it("refuses a missing or empty header", () => {
    expect(verifySignature(null, BODY, SECRET, NOW)).toEqual({ ok: false, reason: "missing" });
    expect(verifySignature("  ", BODY, SECRET, NOW)).toEqual({ ok: false, reason: "missing" });
  });

  it("refuses a header with no time or no signature", () => {
    expect(verifySignature("v1=abc", BODY, SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
    expect(verifySignature(`t=${NOW}`, BODY, SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
    expect(verifySignature(`t=soon,v1=${"a".repeat(64)}`, BODY, SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("refuses a signature older than five minutes, so a captured request cannot be sent again", () => {
    expect(verifySignature(signatureHeader(SECRET, BODY, NOW), BODY, SECRET, NOW + 301)).toEqual({ ok: false, reason: "stale" });
  });

  it("refuses a changed body, another secret, or a signature of the wrong length", () => {
    const header = signatureHeader(SECRET, BODY, NOW);
    expect(verifySignature(header, `${BODY} `, SECRET, NOW)).toEqual({ ok: false, reason: "mismatch" });
    expect(verifySignature(header, BODY, "whsec_other", NOW)).toEqual({ ok: false, reason: "mismatch" });
    expect(verifySignature(`t=${NOW},v1=${"0".repeat(64)}`, BODY, SECRET, NOW)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("accepts any one of several signatures, as while a secret is rolled", () => {
    const good = signatureHeader(SECRET, BODY, NOW).split(",v1=")[1]!;
    expect(verifySignature(`t=${NOW},v1=${"1".repeat(64)},v1=${good},v0=old`, BODY, SECRET, NOW)).toEqual({ ok: true });
  });
});
