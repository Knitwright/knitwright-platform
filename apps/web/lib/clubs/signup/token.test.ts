import { describe, expect, it } from "vitest";
import { isVisitorKey } from "@/lib/share/token";
import { SIGNUP_VISITOR_COOKIE, newVisitorKey, signupAddress, signupCookieOptions } from "./token";

describe("the sign-up page's own cookie", () => {
  it("is scoped to /join, because the share cookie is scoped to /s and never reaches it", () => {
    expect(signupCookieOptions("https://knitwright.test").path).toBe("/join");
    expect(SIGNUP_VISITOR_COOKIE).not.toBe("kw_share_visitor");
  });

  it("is hidden from scripts and sent only on the player's own site", () => {
    expect(signupCookieOptions("https://knitwright.test")).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true });
  });

  it("is not marked secure where the site is served without it, so it works locally", () => {
    expect(signupCookieOptions("http://localhost:3000").secure).toBe(false);
  });

  it("lasts as long as the longest link can", () => {
    expect(signupCookieOptions("https://knitwright.test").maxAge).toBe(60 * 60 * 24 * 90);
  });

  it("holds a key made by the one maker of visitor keys", () => {
    expect(isVisitorKey(newVisitorKey())).toBe(true);
  });
});

describe("signupAddress", () => {
  it("is the address a kit manager copies and sends to their squad", () => {
    expect(signupAddress("https://knitwright.test", "abc")).toBe("https://knitwright.test/join/abc");
  });

  it("does not double the slash where the setting ends in one", () => {
    expect(signupAddress("https://knitwright.test///", "abc")).toBe("https://knitwright.test/join/abc");
  });
});
