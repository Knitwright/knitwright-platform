import { describe, expect, it } from "vitest";
import { canRedo, canUndo, pushed, redone, started, undone, UNDO_DEPTH } from "./index";

describe("undo and redo", () => {
  it("starts with nothing behind and nothing ahead", () => {
    const stack = started("a");

    expect(stack).toEqual({ past: [], present: "a", future: [] });
    expect(canUndo(stack)).toBe(false);
    expect(canRedo(stack)).toBe(false);
  });

  it("goes back one step and forward again", () => {
    const stack = pushed(pushed(started("a"), "b"), "c");

    expect(undone(stack).present).toBe("b");
    expect(undone(undone(stack)).present).toBe("a");
    expect(redone(undone(stack)).present).toBe("c");
    expect(canRedo(undone(stack))).toBe(true);
  });

  it("does nothing at either end, so a button is simply off rather than wrong", () => {
    const start = started("a");

    expect(undone(start)).toBe(start);
    expect(redone(start)).toBe(start);
  });

  it("drops the redo chain once something new is done, so nothing worked past comes back", () => {
    const after = pushed(undone(pushed(started("a"), "b")), "c");

    expect(after).toEqual({ past: ["a"], present: "c", future: [] });
  });

  it("keeps the depth capped, with the oldest state falling off the back", () => {
    let stack = started(0);
    for (let step = 1; step <= UNDO_DEPTH + 10; step += 1) stack = pushed(stack, step);

    expect(stack.past).toHaveLength(UNDO_DEPTH);
    expect(stack.past[0]).toBe(10);
    expect(stack.present).toBe(UNDO_DEPTH + 10);
  });
});
