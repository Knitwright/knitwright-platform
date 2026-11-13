import { describe, expect, it } from "vitest";
import { canvasKey, isPanKey, isTyping } from "./keys";

describe("the canvas's keys", () => {
  it("zoom in, out, to fit and to 100%", () => {
    expect(["+", "=", "-", "_", "0", "1", "x"].map((key) => canvasKey({ key }))).toEqual(["zoom-in", "zoom-in", "zoom-out", "zoom-out", "fit", "actual", null]);
  });

  it("leave Alt-held keys and anything typed into a field alone", () => {
    expect(canvasKey({ key: "+", altKey: true })).toBeNull();
    expect(canvasKey({ key: "1", target: { tagName: "INPUT" } })).toBeNull();
    expect(canvasKey({ key: "1", target: { tagName: "DIV", isContentEditable: true } })).toBeNull();
    expect(canvasKey({ key: "1", target: { tagName: "BUTTON" } })).toBe("actual");
  });

  it("pan with Space, except in a field", () => {
    expect(isPanKey({ key: " " })).toBe(true);
    expect(isPanKey({ key: " ", target: { tagName: "TEXTAREA" } })).toBe(false);
    expect(isPanKey({ key: "Enter" })).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});
