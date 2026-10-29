import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isPacketToken, newPacketToken, packetAddress, packetRateKey, packetTokenHash } from "./token";

describe("newPacketToken", () => {
  it("is 256 random bits written in 43 address-safe characters", () => {
    const token = newPacketToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url").byteLength).toBe(32);
  });

  it("is different every time", () => {
    expect(new Set(Array.from({ length: 200 }, newPacketToken)).size).toBe(200);
  });
});

describe("isPacketToken", () => {
  it("accepts a token the server made", () => {
    expect(isPacketToken(newPacketToken())).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["too short", "a".repeat(42)],
    ["too long", "a".repeat(44)],
    ["padded", `${"a".repeat(42)}=`],
    ["holding a slash", `${"a".repeat(42)}/`],
    ["holding a dot", `${"a".repeat(42)}.`],
    ["holding a space", `${"a".repeat(42)} `],
    ["a path of its own", `../${"a".repeat(40)}`],
    ["not text", 42],
    ["missing", undefined],
    ["null", null],
  ])("refuses a token that is %s", (_, value) => {
    expect(isPacketToken(value)).toBe(false);
  });
});

describe("packetTokenHash", () => {
  it("is the SHA-256 of the token's own characters, as the database computes it", () => {
    const token = newPacketToken();

    expect(packetTokenHash(token)).toEqual(createHash("sha256").update(token, "utf8").digest());
    expect(packetTokenHash(token).byteLength).toBe(32);
  });

  it("is the same every time for one token and different for another", () => {
    const token = newPacketToken();

    expect(packetTokenHash(token)).toEqual(packetTokenHash(token));
    expect(packetTokenHash(token)).not.toEqual(packetTokenHash(newPacketToken()));
  });
});

describe("packetRateKey", () => {
  it("names a packet by a hash, so a token is never written to the rate limit table", () => {
    const token = newPacketToken();
    const key = packetRateKey(token);

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain(token);
    expect(packetRateKey(token)).toBe(key);
    expect(packetRateKey(newPacketToken())).not.toBe(key);
  });
});

describe("packetAddress", () => {
  it("is the site's address with the token under /job/", () => {
    expect(packetAddress("https://app.knitwright.com", "abc")).toBe("https://app.knitwright.com/job/abc");
    expect(packetAddress("http://localhost:3000/", "abc")).toBe("http://localhost:3000/job/abc");
    expect(packetAddress("http://localhost:3000///", "abc")).toBe("http://localhost:3000/job/abc");
  });
});
