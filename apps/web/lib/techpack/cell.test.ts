import { describe, expect, it } from "vitest";
import { TBC, TO_BE_CONFIRMED, isSet, textCell } from "./cell";

describe("cells", () => {
  it("says to be confirmed in the words a factory reads", () => {
    expect(TO_BE_CONFIRMED).toBe("To be confirmed");
  });

  it("holds text together with where it came from", () => {
    expect(textCell("Navy", "user-edited")).toEqual({ status: "set", value: "Navy", provenance: "user-edited" });
  });

  it("trims the text it holds", () => {
    expect(textCell("  Navy  ", "brand-supplied")).toEqual({ status: "set", value: "Navy", provenance: "brand-supplied" });
  });

  it("turns empty text, or text of spaces only, into to be confirmed", () => {
    expect(textCell("", "user-edited")).toBe(TBC);
    expect(textCell("   ", "user-edited")).toBe(TBC);
  });

  it("makes a to be confirmed cell that holds no value and no source", () => {
    expect(Object.keys(TBC)).toEqual(["status"]);
    expect(Object.isFrozen(TBC)).toBe(true);
  });

  it("tells a set cell from a missing one", () => {
    expect(isSet(textCell("Navy", "user-edited"))).toBe(true);
    expect(isSet(TBC)).toBe(false);
  });
});
