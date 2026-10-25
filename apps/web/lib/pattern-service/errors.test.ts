import { describe, expect, it } from "vitest";
import { patternFailure, throwIfPatternFailed } from "./errors";

describe("patternFailure", () => {
  it("explains a wrong step, a missing reason and missing files", () => {
    expect(patternFailure({ message: "x", hint: "invalid_transition" })).toMatchObject({ code: "conflict" });
    expect(patternFailure({ message: "x", hint: "reason_needed" }).message).toMatch(/why/);
    expect(patternFailure({ message: "x", hint: "files_needed" }).message).toMatch(/Attach/);
  });
  it("explains bad input", () => {
    expect(patternFailure({ message: "x", hint: "invalid_input" })).toMatchObject({ code: "invalid_input" });
  });
  it("answers not found for a missing row and falls back to the ops answers", () => {
    expect(patternFailure({ message: "x", code: "P0002" })).toMatchObject({ code: "not_found" });
    expect(patternFailure({ message: "x", code: "XX000" })).toMatchObject({ code: "internal" });
  });
  it("throws only when there is an error", () => {
    expect(() => throwIfPatternFailed(null)).not.toThrow();
    expect(() => throwIfPatternFailed({ message: "x", hint: "files_needed" })).toThrow();
  });
});
