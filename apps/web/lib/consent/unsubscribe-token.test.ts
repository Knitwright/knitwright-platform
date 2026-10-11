import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { proposalKey } from "@/lib/intent/proposal-token";
import { signUnsubscribe, unsubscribeKey, unsubscribeUrl, verifyUnsubscribe } from "./unsubscribe-token";

const KEY = unsubscribeKey("server-secret");
const USER = "6f1c2a4e-1d1b-4b8e-9a51-0c6a3c1f7d20";

describe("unsubscribe tokens", () => {
  it("carry the person they were made for back to the server", () => {
    expect(verifyUnsubscribe(signUnsubscribe(USER, KEY), KEY)).toEqual({ ok: true, userId: USER });
  });

  it("do not run out, so a link in an old email still works", () => {
    const token = signUnsubscribe(USER, KEY);
    expect(token).not.toMatch(/expires/);
    expect(verifyUnsubscribe(token, KEY).ok).toBe(true);
  });

  it("are refused when signed with another key", () => {
    expect(verifyUnsubscribe(signUnsubscribe(USER, unsubscribeKey("other")), KEY).ok).toBe(false);
  });

  it("use a key of their own, not the proposal key made from the same secret", () => {
    expect(unsubscribeKey("server-secret").equals(proposalKey("server-secret"))).toBe(false);
  });

  it("are refused when the person in them was changed", () => {
    const [, signature] = signUnsubscribe(USER, KEY).split(".");
    const forged = `${Buffer.from(JSON.stringify({ u: "someone-else", p: "marketing_email" })).toString("base64url")}.${signature}`;
    expect(verifyUnsubscribe(forged, KEY).ok).toBe(false);
  });

  it.each(["", "abc", "a.b.c", "....", `${"x".repeat(2000)}.y`, "e30.e30"])("are refused when malformed: %j", (token) => {
    expect(verifyUnsubscribe(token, KEY)).toEqual({ ok: false, reason: expect.stringMatching(/link/i) });
  });

  it("are refused when signed but not about marketing email", () => {
    const payload = Buffer.from(JSON.stringify({ u: USER, p: "other" })).toString("base64url");
    const signature = createHmac("sha256", KEY).update(payload).digest("base64url");
    expect(verifyUnsubscribe(`${payload}.${signature}`, KEY).ok).toBe(false);
  });

  it("make a link to the confirm page on this site", () => {
    const url = new URL(unsubscribeUrl("https://knitwright.com", signUnsubscribe(USER, KEY)));
    expect(url.origin).toBe("https://knitwright.com");
    expect(url.pathname).toBe("/unsubscribe");
    expect(verifyUnsubscribe(url.searchParams.get("token") ?? "", KEY).ok).toBe(true);
  });
});
