import { describe, expect, it } from "vitest";
import { clamp, moveIndex, stepNumber, trapIndex } from "./keys";

describe("moving along a row (tabs, segmented, menus)", () => {
  it("moves with the arrows of its orientation and wraps at both ends", () => {
    expect(moveIndex(0, "ArrowRight", 3)).toBe(1);
    expect(moveIndex(2, "ArrowRight", 3)).toBe(0);
    expect(moveIndex(0, "ArrowLeft", 3)).toBe(2);
    expect(moveIndex(1, "ArrowDown", 3, "vertical")).toBe(2);
    expect(moveIndex(0, "ArrowUp", 3, "vertical")).toBe(2);
  });

  it("ignores the other axis and keys that do not move", () => {
    expect(moveIndex(0, "ArrowDown", 3)).toBeNull();
    expect(moveIndex(0, "ArrowRight", 3, "vertical")).toBeNull();
    expect(moveIndex(0, "a", 3)).toBeNull();
    expect(moveIndex(0, "Enter", 3)).toBeNull();
  });

  it("jumps with Home and End", () => {
    expect(moveIndex(1, "Home", 4)).toBe(0);
    expect(moveIndex(1, "End", 4)).toBe(3);
  });

  it("skips what cannot be chosen: a disabled tab, a menu separator", () => {
    const usable = (index: number) => index !== 1 && index !== 3;
    expect(moveIndex(0, "ArrowRight", 4, "horizontal", usable)).toBe(2);
    expect(moveIndex(2, "ArrowRight", 4, "horizontal", usable)).toBe(0);
    expect(moveIndex(0, "End", 4, "horizontal", usable)).toBe(2);
    expect(moveIndex(2, "Home", 4, "horizontal", (index) => index > 0 && usable(index))).toBe(2);
  });

  it("starts at the first or last item when nothing has focus yet", () => {
    expect(moveIndex(-1, "ArrowDown", 3, "vertical")).toBe(0);
    expect(moveIndex(-1, "ArrowUp", 3, "vertical")).toBe(2);
  });

  it("has nowhere to go in an empty row, or one with nothing usable", () => {
    expect(moveIndex(0, "ArrowRight", 0)).toBeNull();
    expect(moveIndex(0, "ArrowRight", 3, "horizontal", () => false)).toBeNull();
  });
});

describe("the focus trap of a modal", () => {
  it("wraps Tab from the last element to the first", () => {
    expect(trapIndex(2, 3, false)).toBe(0);
  });

  it("wraps Shift+Tab from the first element to the last", () => {
    expect(trapIndex(0, 3, true)).toBe(2);
  });

  it("leaves Tab to the browser in the middle", () => {
    expect(trapIndex(1, 3, false)).toBeNull();
    expect(trapIndex(1, 3, true)).toBeNull();
  });

  it("brings focus that escaped back inside", () => {
    expect(trapIndex(-1, 3, false)).toBe(0);
    expect(trapIndex(-1, 3, true)).toBe(2);
  });

  it("does nothing when the modal has nothing to focus", () => {
    expect(trapIndex(-1, 0, false)).toBeNull();
  });
});

describe("a number with its unit", () => {
  it("steps by 1 with the arrows and by 10 with Shift", () => {
    expect(stepNumber(520, "ArrowUp", false)).toBe(521);
    expect(stepNumber(520, "ArrowDown", false)).toBe(519);
    expect(stepNumber(520, "ArrowUp", true)).toBe(530);
    expect(stepNumber(520, "ArrowDown", true)).toBe(510);
  });

  it("stays inside its bounds", () => {
    expect(stepNumber(698, "ArrowUp", true, { max: 700 })).toBe(700);
    expect(stepNumber(401, "ArrowDown", true, { min: 400 })).toBe(400);
  });

  it("uses its own steps and leaves no float noise, nor drops the value's decimals", () => {
    expect(stepNumber(0.1, "ArrowUp", false, { step: 0.2 })).toBe(0.3);
    expect(stepNumber(12.5, "ArrowUp", true)).toBe(22.5);
    expect(stepNumber(12.5, "ArrowUp", true, { bigStep: 5 })).toBe(17.5);
  });

  it("answers null for keys that do not step", () => {
    expect(stepNumber(1, "ArrowLeft", false)).toBeNull();
    expect(stepNumber(1, "Enter", false)).toBeNull();
  });

  it("clamps with either bound missing", () => {
    expect(clamp(5)).toBe(5);
    expect(clamp(5, 6)).toBe(6);
    expect(clamp(5, undefined, 4)).toBe(4);
  });
});
