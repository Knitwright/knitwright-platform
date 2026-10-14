import { describe, expect, it } from "vitest";
import { acceptBody, canAccept, hasMoves, initialScreen, screenReducer, type ScreenAction, type ScreenState } from "./screen";

const run = (...actions: ScreenAction[]): ScreenState => actions.reduce(screenReducer, initialScreen);
const ready = run({ type: "chosen", previewUrl: "blob:x" }, { type: "uploaded" }, { type: "ready", importId: "i1", layerIds: ["ground", "mark-1"] });

describe("screen", () => {
  it("goes from a chosen picture to a review with every layer ticked", () => {
    expect(run({ type: "chosen", previewUrl: "blob:x" }).stage).toBe("uploading");
    expect(run({ type: "chosen", previewUrl: "blob:x" }, { type: "uploaded" }).stage).toBe("reading");
    expect(ready).toMatchObject({ stage: "review", importId: "i1" });
    expect([...ready.ticked]).toEqual(["ground", "mark-1"]);
    expect(canAccept(ready)).toBe(true);
  });

  it("ticks and unticks layers, and accepts nothing when none is ticked", () => {
    const off = screenReducer(ready, { type: "tick", id: "mark-1", on: false });
    expect([...off.ticked]).toEqual(["ground"]);
    expect(acceptBody(off, ["ground", "mark-1"])).toEqual({ layerIds: ["ground"] });
    expect(acceptBody(ready, ["ground", "mark-1"])).toEqual({ layerIds: "all" });
    const none = screenReducer(ready, { type: "tick-all", layerIds: [], on: false });
    expect(canAccept(none)).toBe(false);
    expect(screenReducer(none, { type: "tick-all", layerIds: ["ground"], on: true }).ticked.has("ground")).toBe(true);
    expect(screenReducer(off, { type: "tick", id: "mark-1", on: true }).ticked.has("mark-1")).toBe(true);
  });

  it("starts an alternative picture unticked, and makes it and its pattern one or the other", () => {
    const withAlt = run({ type: "chosen", previewUrl: "blob:x" }, { type: "ready", importId: "i1", layerIds: ["ground", "pattern-front", "pattern-front-alt"] });
    expect([...withAlt.ticked]).toEqual(["ground", "pattern-front"]);
    expect(acceptBody(withAlt, ["ground", "pattern-front", "pattern-front-alt"])).toEqual({ layerIds: "all" });
    const swapped = screenReducer(withAlt, { type: "tick", id: "pattern-front-alt", on: true });
    expect([...swapped.ticked]).toEqual(["ground", "pattern-front-alt"]);
    expect(acceptBody(swapped, ["ground", "pattern-front", "pattern-front-alt"])).toEqual({ layerIds: ["ground", "pattern-front-alt"] });
    const back = screenReducer(swapped, { type: "tick", id: "pattern-front", on: true });
    expect([...back.ticked]).toEqual(["ground", "pattern-front"]);
    expect([...screenReducer(back, { type: "tick-all", layerIds: ["ground", "pattern-front", "pattern-front-alt"], on: true }).ticked]).toEqual(["ground", "pattern-front"]);
    expect([...screenReducer(back, { type: "refitted", layerIds: ["ground", "pattern-front-alt"] }).ticked]).toEqual(["ground"]);
  });

  it("keeps dragged landmarks inside the picture until a fit is redone", () => {
    const moved = screenReducer(ready, { type: "move", view: "front", id: "hps", x: 1.4, y: -0.2 });
    expect(moved.moved).toEqual({ front: { hps: { x: 1, y: 0 } } });
    expect(hasMoves(moved)).toBe(true);
    expect(hasMoves(ready)).toBe(false);
    const again = screenReducer(moved, { type: "move", view: "front", id: "underarm", x: 0.5, y: 0.5 });
    expect(Object.keys(again.moved.front ?? {})).toEqual(["hps", "underarm"]);
    const refitted = screenReducer(screenReducer(again, { type: "working" }), { type: "refitted", layerIds: ["ground"] });
    expect(refitted).toMatchObject({ stage: "review", moved: {} });
  });

  it("finishes, fails and discards", () => {
    expect(screenReducer(ready, { type: "done", message: "ok" })).toMatchObject({ stage: "done", message: "ok" });
    expect(screenReducer(ready, { type: "failed", message: "no" })).toMatchObject({ stage: "failed", message: "no" });
    expect(screenReducer(ready, { type: "discard" })).toEqual(initialScreen);
    expect(canAccept({ ...ready, stage: "working" })).toBe(false);
  });
});
