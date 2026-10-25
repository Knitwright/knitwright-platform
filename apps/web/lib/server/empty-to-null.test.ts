import { describe, expect, it } from "vitest";
import { emptyToNull } from "./empty-to-null";

describe("emptyToNull", () => {
  it("turns empty and blank strings into null", () => {
    expect(emptyToNull("")).toBeNull();
    expect(emptyToNull("   ")).toBeNull();
  });

  it("leaves other values as they are", () => {
    expect(emptyToNull("12")).toBe("12");
    expect(emptyToNull(0)).toBe(0);
    expect(emptyToNull(undefined)).toBeUndefined();
    expect(emptyToNull(null)).toBeNull();
  });
});
