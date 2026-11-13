import { describe, expect, it } from "vitest";
import { openToken, sealToken, tokenKey } from "./token-crypto";

const KEY = tokenKey("ab".repeat(32), "server");

describe("a shop's token at rest (decision 0155)", () => {
  it("is sealed with AES-256-GCM and opens only with the same key and shop", () => {
    const sealed = sealToken(KEY, "shpat_secret", "a.myshopify.com");
    expect(sealed.ciphertext).not.toContain("shpat");
    expect(Buffer.from(sealed.nonce, "base64")).toHaveLength(12);
    expect(openToken(KEY, sealed, "a.myshopify.com")).toBe("shpat_secret");
    expect(openToken(KEY, sealed, "b.myshopify.com")).toBeNull();
    expect(openToken(tokenKey(undefined, "server"), sealed, "a.myshopify.com")).toBeNull();
  });

  it("uses a fresh nonce each time, and refuses a tampered or malformed seal", () => {
    const one = sealToken(KEY, "t", "a.myshopify.com");
    const two = sealToken(KEY, "t", "a.myshopify.com");
    expect(one.nonce).not.toBe(two.nonce);
    const flipped = Buffer.from(one.ciphertext, "base64");
    flipped[0] = flipped[0]! ^ 1;
    expect(openToken(KEY, { ...one, ciphertext: flipped.toString("base64") }, "a.myshopify.com")).toBeNull();
    expect(openToken(KEY, { ciphertext: "AAAA", nonce: one.nonce }, "a.myshopify.com")).toBeNull();
    expect(openToken(KEY, { ciphertext: one.ciphertext, nonce: "AAAA" }, "a.myshopify.com")).toBeNull();
  });

  it("takes CHANNEL_TOKEN_KEY's hex, or derives a key from the server key, and refuses a bad key", () => {
    expect(tokenKey("00".repeat(32), "x")).toHaveLength(32);
    expect(tokenKey(undefined, "x").equals(tokenKey(undefined, "x"))).toBe(true);
    expect(tokenKey(undefined, "x").equals(tokenKey(undefined, "y"))).toBe(false);
    expect(() => tokenKey("short", "x")).toThrow(/64 hex/);
  });
});
