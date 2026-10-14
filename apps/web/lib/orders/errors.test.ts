import { describe, expect, it } from "vitest";
import { productionFailure, throwIfFailed } from "./errors";

describe("productionFailure", () => {
  it.each([
    ["too_many_orders", "conflict"],
    ["append_only", "conflict"],
    ["not_received", "conflict"],
  ])("maps the %s hint to a conflict a person can read", (hint, code) => {
    const failure = productionFailure({ hint, message: "x" }, "n/a");
    expect(failure.code).toBe(code);
    expect(failure.message).not.toContain("x");
  });
  it("says not found for a missing record and for an id that is not an id", () => {
    expect(productionFailure({ code: "P0002", message: "m" }, "Gone.")).toMatchObject({ code: "not_found", message: "Gone." });
    expect(productionFailure({ code: "22P02", message: "m" }, "Gone.").code).toBe("not_found");
  });
  it("says invalid input for values the database refuses", () => {
    expect(productionFailure({ code: "23514", message: "m" }, "").code).toBe("invalid_input");
  });
  it("says nothing of an unknown fault", () => {
    const failure = productionFailure({ code: "XX000", message: "secret detail" }, "");
    expect(failure.code).toBe("internal");
    expect(failure.message).not.toContain("secret");
  });
  it("throws only when there is an error", () => {
    expect(() => throwIfFailed(null, "")).not.toThrow();
    expect(() => throwIfFailed({ code: "P0002", message: "m" }, "Gone.")).toThrow("Gone.");
  });
});
