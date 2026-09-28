import { describe, expect, it } from "vitest";
import { sessionCookieOptions } from "./cookie-options";

describe("sessionCookieOptions", () => {
  it("hides the session from scripts in the page", () => {
    expect(sessionCookieOptions("https://app.knitwright.com").httpOnly).toBe(true);
    expect(sessionCookieOptions("http://localhost:3000").httpOnly).toBe(true);
  });

  it("sends the session over https only when the site is served over https", () => {
    expect(sessionCookieOptions("https://app.knitwright.com").secure).toBe(true);
  });

  it("still works on a local http address, where a secure cookie would never be sent", () => {
    expect(sessionCookieOptions("http://localhost:3000").secure).toBe(false);
  });

  it("is not sent along with requests that other sites make", () => {
    expect(sessionCookieOptions("https://app.knitwright.com").sameSite).toBe("lax");
  });

  it("covers the whole site", () => {
    expect(sessionCookieOptions("https://app.knitwright.com").path).toBe("/");
  });
});
