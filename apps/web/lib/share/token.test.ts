import { describe, expect, it } from "vitest";
import {
  isShareToken,
  isVisitorKey,
  linkRateKey,
  newShareToken,
  newVisitorKey,
  shareAddress,
  SHARE_VISITOR_COOKIE,
  visitorCookieOptions,
} from "./token";

describe("newShareToken", () => {
  it("is 256 random bits written in 43 address-safe characters", () => {
    const token = newShareToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url").byteLength).toBe(32);
  });

  it("is different every time", () => {
    const tokens = new Set(Array.from({ length: 200 }, newShareToken));

    expect(tokens.size).toBe(200);
  });
});

describe("isShareToken", () => {
  it("accepts a token the server made", () => {
    expect(isShareToken(newShareToken())).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["too short", "a".repeat(42)],
    ["too long", "a".repeat(44)],
    ["padding", `${"a".repeat(42)}=`],
    ["a slash", `${"a".repeat(42)}/`],
    ["a dot", `${"a".repeat(42)}.`],
    ["not text", 42],
    ["missing", undefined],
  ])("refuses a token that is %s", (_, value) => {
    expect(isShareToken(value)).toBe(false);
  });
});

describe("visitor keys", () => {
  it("are random, 43 characters, and told apart from anything else", () => {
    const key = newVisitorKey();

    expect(isVisitorKey(key)).toBe(true);
    expect(key).not.toBe(newVisitorKey());
    expect(isVisitorKey("x")).toBe(false);
    expect(isVisitorKey(undefined)).toBe(false);
  });

  it("live in a cookie scripts cannot read, sent only to share pages", () => {
    expect(SHARE_VISITOR_COOKIE).toBe("kw_share_visitor");
    expect(visitorCookieOptions("https://app.knitwright.com")).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/s",
      maxAge: 60 * 60 * 24 * 90,
    });
    expect(visitorCookieOptions("http://localhost:3000").secure).toBe(false);
  });
});

describe("shareAddress", () => {
  it("is the site's address with the token under /s/", () => {
    expect(shareAddress("https://app.knitwright.com", "abc")).toBe("https://app.knitwright.com/s/abc");
    expect(shareAddress("http://localhost:3000/", "abc")).toBe("http://localhost:3000/s/abc");
  });
});

describe("linkRateKey", () => {
  it("names a link by a hash, so a token is never written to the rate limit table", () => {
    const token = newShareToken();
    const key = linkRateKey(token);

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain(token);
    expect(linkRateKey(token)).toBe(key);
    expect(linkRateKey(newShareToken())).not.toBe(key);
  });
});
