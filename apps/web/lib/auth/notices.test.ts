import { describe, expect, it } from "vitest";
import { noticeAfterGoogle, noticeFor, NOTICES } from "./notices";

describe("noticeFor", () => {
  it("returns the message for a known key", () => {
    expect(noticeFor("google-failed")?.text).toMatch(/Google/);
  });

  it("confirms, calmly, that an account was deleted", () => {
    expect(noticeFor("account-deleted")).toEqual({
      tone: "ok",
      text: "Your account and everything in it have been deleted.",
    });
  });

  it("returns nothing for a key it does not know", () => {
    expect(noticeFor("<script>alert(1)</script>")).toBeNull();
    expect(noticeFor("")).toBeNull();
  });

  it("returns nothing for names every object has", () => {
    expect(noticeFor("constructor")).toBeNull();
    expect(noticeFor("toString")).toBeNull();
    expect(noticeFor("__proto__")).toBeNull();
  });

  it("returns nothing for a value given more than once", () => {
    expect(noticeFor(["google-failed", "google-failed"])).toBeNull();
    expect(noticeFor(undefined)).toBeNull();
  });
});

describe("noticeAfterGoogle", () => {
  it("says sign-up is closed when the sign-in service refused a new account", () => {
    expect(
      noticeAfterGoogle({
        error: "access_denied",
        error_description: "Sign-up is closed. Knitwright is not open to new accounts yet.",
      }),
    ).toBe("sign-up-closed");
  });

  it("says sign-in did not finish for any other error", () => {
    expect(noticeAfterGoogle({ error: "server_error", error_description: "boom" })).toBe(
      "google-failed",
    );
    expect(noticeAfterGoogle({ error: "access_denied" })).toBe("google-failed");
  });

  it("says sign-in did not finish when there is neither a code nor an error", () => {
    expect(noticeAfterGoogle({})).toBe("google-failed");
  });

  it("never returns the text it was given", () => {
    const notice = noticeAfterGoogle({
      error: "x",
      error_description: "<script>alert(1)</script>",
    });
    expect(Object.keys(NOTICES)).toContain(notice);
  });
});
