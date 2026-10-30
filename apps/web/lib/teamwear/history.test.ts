import { describe, expect, it } from "vitest";
import { canRedo, canUndo, HISTORY_LIMIT, pushHistory, redo, startHistory, undo } from "./history";

describe("the undo and redo buttons", () => {
  it("starts with nothing behind it and nothing in front of it", () => {
    const history = startHistory("a");
    expect(history).toEqual({ past: [], present: "a", future: [] });
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it("goes back a step and forward again", () => {
    const history = pushHistory(pushHistory(startHistory("a"), "b"), "c");
    const back = undo(history);
    expect(back.present).toBe("b");
    expect(canRedo(back)).toBe(true);
    expect(redo(back).present).toBe("c");
    expect(redo(back).future).toEqual([]);
  });

  it("drops the redo side once a new change is made, as every editor does", () => {
    const back = undo(pushHistory(startHistory("a"), "b"));
    expect(pushHistory(back, "c")).toEqual({ past: ["a"], present: "c", future: [] });
  });

  it("stays as it is at either end, rather than failing", () => {
    const history = startHistory("a");
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it("ignores a change to the value it already holds", () => {
    const history = startHistory("a");
    expect(pushHistory(history, "a")).toBe(history);
  });

  it("keeps the stack capped, so a long session cannot grow without bound", () => {
    let history = startHistory(0);
    for (let step = 1; step <= HISTORY_LIMIT + 10; step += 1) history = pushHistory(history, step);
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0]).toBe(10);
    expect(history.present).toBe(HISTORY_LIMIT + 10);
  });
});
