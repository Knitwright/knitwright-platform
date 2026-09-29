import { describe, expect, it } from "vitest";
import { must } from "./invariant";

describe("must", () => {
  it("returns a value that is there, including zero and empty text", () => {
    expect(must(0, "a count")).toBe(0);
    expect(must("", "a label")).toBe("");
  });

  it("throws a sentence that says which fact broke when the value is missing", () => {
    expect(() => must(undefined, "the value at size M")).toThrow(
      "Sizing broke a rule it depends on: the value at size M was missing.",
    );
  });
});
