import { describe, expect, it } from "vitest";
import { board, ready } from "./fixtures/canvas";
import { TASK_ACTIONS, taskBar } from "./index";

const itemsOf = (bar: ReturnType<typeof taskBar>) => Object.fromEntries((bar?.items ?? []).map((item) => [item.id, item]));

describe("the contextual task bar", () => {
  it("shows nothing when nothing is selected", () => {
    expect(taskBar(null)).toBeNull();
  });

  it("names the board it is over", () => {
    expect(taskBar({ board: board("b", "mockup"), image: false })?.title).toBe("Mockup board");
    expect(taskBar({ board: board("b", "ai_image"), image: true })?.title).toBe("AI image picture");
  });

  it("offers on a board the kinds that board may feed, with the paid ones marked", () => {
    const bar = taskBar({ board: board("b", "mockup"), image: false });

    expect(bar?.add.map((entry) => entry.kind)).toEqual(["ai_image", "ai_video", "marketing"]);
    expect(bar?.add.filter((entry) => entry.paid).map((entry) => entry.kind)).toEqual(["ai_image", "ai_video"]);
  });

  it("puts Flatten, Upscale and Reframe under more, as the spec groups them", () => {
    const bar = taskBar({ board: ready(board("b", "ai_image")), image: false });

    expect(bar?.items.filter((item) => item.inMore).map((item) => item.id)).toEqual(["flatten", "upscale", "reframe", "remove"]);
  });

  it("names every action out of one list, so the shell handles each of them", () => {
    for (const selection of [true, false]) {
      const bar = taskBar({ board: ready(board("b", "ai_image")), image: selection });
      for (const item of bar?.items ?? []) expect(TASK_ACTIONS).toContain(item.id);
    }
  });
});

describe("the garment lock in the task bar", () => {
  it("offers Remove background and Remix on a generated picture", () => {
    const items = itemsOf(taskBar({ board: ready(board("b", "ai_image")), image: true }));

    expect(items["remove-background"]?.disabledReason).toBeNull();
    expect(items["remix"]?.disabledReason).toBeNull();
  });

  it("turns both off on a picture the platform drew, and says why", () => {
    const items = itemsOf(taskBar({ board: ready(board("b", "mockup")), image: true }));

    expect(items["remove-background"]?.disabledReason).toMatch(/the garment in it cannot be changed/);
    expect(items["remix"]?.disabledReason).toMatch(/the garment in it cannot be changed/);
  });
});

describe("an action that would hand over nothing", () => {
  it("is off until the board has run, and says what to do", () => {
    const items = itemsOf(taskBar({ board: board("b", "ai_image"), image: false }));

    expect(items["download"]?.disabledReason).toBe("Run this board first: there is nothing to hand over yet.");
    expect(items["flatten"]?.disabledReason).not.toBeNull();
    expect(items["duplicate"]?.disabledReason).toBeNull();
  });

  it("is on once the board holds a finished output", () => {
    const items = itemsOf(taskBar({ board: ready(board("b", "ai_image")), image: false }));

    expect(items["download"]?.disabledReason).toBeNull();
    expect(items["flatten"]?.disabledReason).toBeNull();
  });

  it("stays off for a board whose status says ready but holds no file", () => {
    const half = { ...board("b", "ai_image"), status: "ready" as const };
    expect(itemsOf(taskBar({ board: half, image: false }))["download"]?.disabledReason).not.toBeNull();
  });
});
