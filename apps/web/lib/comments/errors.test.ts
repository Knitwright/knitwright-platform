import { describe, expect, it } from "vitest";
import { commentFailure, throwIfFailed } from "./errors";

const fail = (code: string | undefined, hint?: string) => commentFailure({ code, hint: hint ?? null, message: "raw database text" }, "That comment does not exist.");

describe("commentFailure", () => {
  it("names the limits a person can act on", () => {
    expect(fail("P0001", "rate_limited")).toMatchObject({ code: "rate_limited" });
    expect(fail("P0001", "too_many_comments")).toMatchObject({ code: "conflict" });
    expect(fail("42501", "edit_window_closed")).toMatchObject({ code: "forbidden", message: expect.stringContaining("15 minutes") });
    expect(fail("22023", "mention_not_member")).toMatchObject({ code: "invalid_input", message: expect.stringContaining("members") });
    expect(fail("22023", "too_many_mentions")).toMatchObject({ code: "invalid_input" });
  });

  it("answers a missing comment and another brand's comment the same way", () => {
    expect(fail("P0002")).toMatchObject({ code: "not_found", message: "That comment does not exist." });
  });

  it("maps the other database codes", () => {
    expect(fail("42501")).toMatchObject({ code: "forbidden" });
    expect(fail("22023")).toMatchObject({ code: "invalid_input" });
    expect(fail("23514")).toMatchObject({ code: "invalid_input" });
    expect(fail("22P02")).toMatchObject({ code: "not_found" });
  });

  it("never passes database text to the person", () => {
    const failure = fail("XX000");
    expect(failure.code).toBe("internal");
    expect(failure.message).not.toContain("raw database text");
  });
});

describe("throwIfFailed", () => {
  it("does nothing without an error and throws the mapped failure with one", () => {
    expect(() => throwIfFailed(null, "x")).not.toThrow();
    expect(() => throwIfFailed({ code: "P0002", message: "m" }, "gone")).toThrowError("gone");
  });
});
