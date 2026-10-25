import { describe, expect, it } from "vitest";
import { brandRunFailure, NOT_ALLOWED, throwIfFailed } from "./errors";

const fail = (code?: string, hint?: string) => brandRunFailure({ code, hint, message: "raw database text" }, "That product does not exist.");

describe("brandRunFailure", () => {
  it.each([
    ["too_many_products", "conflict"],
    ["stage_blocks", "conflict"],
    ["stage_move", "conflict"],
    ["need_sample_order", "conflict"],
    ["request_key_conflict", "conflict"],
    ["external_ref_conflict", "conflict"],
    ["invalid_sizes", "invalid_input"],
    ["invalid_input", "invalid_input"],
  ])("reads hint %s as %s", (hint, code) => {
    expect(fail("P0001", hint).code).toBe(code);
  });
  it("never shows raw database text", () => {
    for (const code of ["42501", "P0002", "22P02", "23505", "22023", "23514", "22003", "XX000"]) {
      expect(fail(code).message).not.toContain("raw database");
    }
  });
  it("answers forbidden with the role message", () => {
    expect(fail("42501")).toMatchObject({ code: "forbidden", message: NOT_ALLOWED });
  });
  it("gives a missing record and a malformed id the same answer", () => {
    expect(fail("P0002").message).toBe("That product does not exist.");
    expect(fail("22P02").message).toBe("That product does not exist.");
  });
  it("reads a repeated product as a conflict", () => {
    expect(fail("23505").code).toBe("conflict");
  });
  it("reads a bad value as invalid input", () => {
    for (const code of ["22023", "23514", "22003"]) expect(fail(code).code).toBe("invalid_input");
  });
  it("hides anything else as an internal failure", () => {
    expect(fail("XX000").code).toBe("internal");
    expect(fail(undefined).code).toBe("internal");
  });
  it("throws only when there is an error", () => {
    expect(() => throwIfFailed(null, "x")).not.toThrow();
    expect(() => throwIfFailed({ code: "P0002", message: "m" }, "x")).toThrow("x");
  });
});
