import { describe, expect, it } from "vitest";
import { noticeFor } from "./notices";

describe("noticeFor", () => {
  it("returns the message for a known key", () => {
    expect(noticeFor("google-failed")?.text).toMatch(/Google/);
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
