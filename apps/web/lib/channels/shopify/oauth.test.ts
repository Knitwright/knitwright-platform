import { describe, expect, it } from "vitest";
import { signQuery } from "./hmac";
import { authorizeQuery, checkReturn, newState, readStateCookie, stateCookie, STATE_SECONDS } from "./oauth";

const SECRET = "app-secret";
const NOW = 1_800_000_000;
const WHO = { brandId: "b1", userId: "u1" };
const SHOP = "club.myshopify.com";

const state = newState({ ...WHO, shop: SHOP }, NOW, "nonce-1");
const cookie = stateCookie(SECRET, state);
const signed = (params: Record<string, string>) => ({ ...params, hmac: signQuery(SECRET, params) });
const returned = signed({ code: "abc", shop: SHOP, state: "nonce-1", timestamp: String(NOW) });

describe("the install state (decision 0155)", () => {
  it("round-trips through a signed cookie until it expires", () => {
    expect(readStateCookie(SECRET, cookie, NOW)).toEqual(state);
    expect(readStateCookie(SECRET, cookie, NOW + STATE_SECONDS + 1)).toBeNull();
    expect(readStateCookie("other", cookie, NOW)).toBeNull();
    expect(readStateCookie(SECRET, undefined, NOW)).toBeNull();
    expect(readStateCookie(SECRET, "garbage", NOW)).toBeNull();
    expect(readStateCookie(SECRET, `${cookie.split(".")[0]}x.${cookie.split(".")[1]}`, NOW)).toBeNull();
  });

  it("makes a fresh nonce when none is given, and asks for the app's scopes", () => {
    expect(newState({ ...WHO, shop: SHOP }, NOW).nonce).not.toBe(newState({ ...WHO, shop: SHOP }, NOW).nonce);
    const query = new URLSearchParams(authorizeQuery("key", "https://kw.test/cb", "n"));
    expect(query.get("client_id")).toBe("key");
    expect(query.get("scope")).toContain("write_products");
    expect(query.get("redirect_uri")).toBe("https://kw.test/cb");
    expect(query.get("state")).toBe("n");
    expect(query.has("grant_options[]")).toBe(false);
  });
});

describe("Shopify's return", () => {
  it("is accepted with Shopify's hmac, our state, and the same person", () => {
    expect(checkReturn(SECRET, returned, cookie, WHO, NOW)).toEqual({ ok: true, shop: SHOP, code: "abc", state });
  });

  it("is refused for a bad signature, a bad shop, a wrong state or another person", () => {
    expect(checkReturn(SECRET, { ...returned, code: "forged" }, cookie, WHO, NOW)).toEqual({ ok: false, reason: "signature" });
    expect(checkReturn(SECRET, signed({ code: "abc", shop: "evil.com", state: "nonce-1" }), cookie, WHO, NOW)).toEqual({ ok: false, reason: "shop" });
    expect(checkReturn(SECRET, signed({ shop: SHOP, state: "nonce-1" }), cookie, WHO, NOW)).toEqual({ ok: false, reason: "shop" });
    expect(checkReturn(SECRET, signed({ code: "abc", shop: SHOP, state: "other" }), cookie, WHO, NOW)).toEqual({ ok: false, reason: "state" });
    expect(checkReturn(SECRET, signed({ code: "abc", shop: "else.myshopify.com", state: "nonce-1" }), cookie, WHO, NOW)).toEqual({ ok: false, reason: "state" });
    expect(checkReturn(SECRET, returned, undefined, WHO, NOW)).toEqual({ ok: false, reason: "state" });
    expect(checkReturn(SECRET, returned, cookie, { ...WHO, userId: "u2" }, NOW)).toEqual({ ok: false, reason: "person" });
    expect(checkReturn(SECRET, returned, cookie, { ...WHO, brandId: "b2" }, NOW)).toEqual({ ok: false, reason: "person" });
  });
});
