import { describe, expect, it } from "vitest";
import { clubFailure, NOT_ALLOWED, throwIfFailed } from "./errors";

describe("clubFailure", () => {
  it.each([
    [{ code: "42501", message: "x" }, "forbidden", NOT_ALLOWED],
    [{ code: "P0002", message: "x" }, "not_found", "Gone."],
    [{ code: "22P02", message: "x" }, "not_found", "Gone."],
    [{ code: "23505", message: "x" }, "conflict", "That already exists."],
    [{ code: "22023", message: "x" }, "invalid_input", undefined],
    [{ code: "XX000", message: "secret detail" }, "internal", undefined],
  ] as const)("%j is %s", (error, code, message) => {
    const failure = clubFailure(error, "Gone.");
    expect(failure.code).toBe(code);
    if (message) expect(failure.message).toBe(message);
    expect(failure.message).not.toContain("secret detail");
  });

  it("explains limits and the fixed owner in plain words", () => {
    expect(clubFailure({ code: "P0001", hint: "too_many_seasons", message: "x" }, "n").message).toMatch(/20 seasons/);
    expect(clubFailure({ code: "P0001", hint: "owner_fixed", message: "x" }, "n").code).toBe("conflict");
    expect(clubFailure({ code: "P0001", hint: "brand_limit", message: "x" }, "n").message).toMatch(/3/);
    expect(clubFailure({ code: "P0001", hint: "too_many_members", message: "x" }, "n").message).toMatch(/50/);
  });

  it("throws only when there is an error", () => {
    expect(() => throwIfFailed(null, "n")).not.toThrow();
    expect(() => throwIfFailed({ code: "42501", message: "x" }, "n")).toThrow(NOT_ALLOWED);
  });
});
