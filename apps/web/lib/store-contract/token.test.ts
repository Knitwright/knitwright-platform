import { describe, expect, it } from "vitest";
import { canonicalQuery, signStoreToken, TOKEN_HEADER, TOKEN_LIFETIME_SECONDS, verifyStoreToken } from "./token";
import { admitStoreCall, SECRET_MISSING } from "./admit";

/**
 * The signed service token, and the one door it opens. The same idiom as the files-service token
 * (decision 0070): the caller is a service, so there is no session to check and the signature says
 * which payload is being asked for, with which query, and until when.
 */

const SECRET = "s".repeat(32);
const NOW = 1_800_000_000;

const sign = (payload = "store-products", query = "limit=50", now = NOW) => signStoreToken(SECRET, payload, query, now).token;

describe("signing a call", () => {
  it("binds the payload kind, the query and an expiry, and says when it runs out", () => {
    const signed = signStoreToken(SECRET, "store-products", "limit=50", NOW);

    expect(signed.expiresAt).toBe(NOW + TOKEN_LIFETIME_SECONDS);
    expect(signed.token.startsWith("v1.store-products.")).toBe(true);
    expect(signed.token.split(".")).toHaveLength(5);
    expect(verifyStoreToken(SECRET, signed.token, "store-products", "limit=50", NOW)).toBe(true);
  });

  it("refuses to sign with a secret too short to stand in front of every brand's products", () => {
    expect(() => signStoreToken("short", "store-products", "", NOW)).toThrow(/at least 32 characters/);
  });

  it("writes the query one way, so the order the caller sent it in does not matter", () => {
    expect(canonicalQuery({ limit: "50", brandId: "b" })).toBe("brandId=b&limit=50");
    expect(canonicalQuery({ brandId: "b", limit: "50" })).toBe("brandId=b&limit=50");
    expect(canonicalQuery({ brandId: undefined, limit: "50", country: "" })).toBe("limit=50");
  });
});

describe("checking a token", () => {
  it("refuses one signed with another secret", () => {
    expect(verifyStoreToken("t".repeat(32), sign(), "store-products", "limit=50", NOW)).toBe(false);
  });

  it("refuses one signed for another payload, so a token for the drops cannot read the products", () => {
    expect(verifyStoreToken(SECRET, sign("store-drops"), "store-products", "limit=50", NOW)).toBe(false);
  });

  it("refuses one signed over another query, so a token caught in a log cannot read another brand", () => {
    expect(verifyStoreToken(SECRET, sign("store-products", "brandId=mine"), "store-products", "brandId=theirs", NOW)).toBe(false);
  });

  it("refuses one that has run out, and reads the expiry before the signature", () => {
    expect(verifyStoreToken(SECRET, sign(), "store-products", "limit=50", NOW + TOKEN_LIFETIME_SECONDS + 1)).toBe(false);
  });

  it("refuses anything that is not shaped like a token at all", () => {
    for (const token of ["", "v1", "v1.store-products.x.y.z", `v2.${sign().split(".").slice(1).join(".")}`]) {
      expect(verifyStoreToken(SECRET, token, "store-products", "limit=50", NOW)).toBe(false);
    }
  });

  it("refuses everything while the secret is too short, rather than comparing against it", () => {
    expect(verifyStoreToken("short", sign(), "store-products", "limit=50", NOW)).toBe(false);
  });
});

describe("the door onto an endpoint", () => {
  const admit = (over: Partial<Parameters<typeof admitStoreCall>[0]> = {}) =>
    admitStoreCall({
      header: sign(),
      secret: SECRET,
      payload: "store-products",
      query: { limit: "50" },
      nowSeconds: NOW,
      ...over,
    });

  it("opens for a token signed over this call's own query", () => {
    expect(admit()).toEqual({ ok: true });
  });

  it("takes the token with or without a bearer prefix", () => {
    expect(admit({ header: `Bearer ${sign()}` })).toEqual({ ok: true });
  });

  it("switches the endpoint off, rather than opening it, while the secret is unset", () => {
    expect(admit({ secret: undefined })).toEqual({ ok: false, status: 503, reason: SECRET_MISSING });
    expect(admit({ secret: "short" }).ok).toBe(false);
  });

  it("answers 404 for a missing or wrong token, and says how to sign one", () => {
    const refusal = admit({ header: null });
    if (refusal.ok) throw new Error("refused");

    expect(refusal.status).toBe(404);
    expect(refusal.reason).toContain(TOKEN_HEADER);
    expect(refusal.reason).toContain("store-products");
    expect(refusal.reason).toContain("docs/store-contract-v2.md");
  });

  it("says the same thing however the token failed, so a caller learns nothing from which half was wrong", () => {
    const missing = admit({ header: null });
    const wrong = admit({ header: sign("store-drops") });
    const stale = admit({ nowSeconds: NOW + TOKEN_LIFETIME_SECONDS + 1 });

    expect([missing, wrong, stale].map((one) => (one.ok ? "" : one.reason))).toEqual([
      missing.ok ? "" : missing.reason,
      missing.ok ? "" : missing.reason,
      missing.ok ? "" : missing.reason,
    ]);
  });

  it("refuses a query the token was not signed over, however the caller ordered it", () => {
    expect(admit({ query: { limit: "50", brandId: "someone-else" } }).ok).toBe(false);
  });
});
