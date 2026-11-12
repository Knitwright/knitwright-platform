import { describe, expect, it, vi } from "vitest";
import { createCanvasStore, marqueeRect, merged, primaryOf, toggled } from "./store";
import { screenToWorld } from "./viewport";

describe("the canvas store's selection", () => {
  it("selects one board with a click and none with a click on nothing", () => {
    const store = createCanvasStore();
    store.select("a");
    expect(store.getState().selection).toEqual(["a"]);
    expect(primaryOf(store.getState())).toBe("a");
    store.select(null);
    expect(store.getState().selection).toEqual([]);
    expect(primaryOf(store.getState())).toBeNull();
  });

  it("adds and removes with Shift, keeping the primary first", () => {
    expect(toggled(["a"], "b")).toEqual(["a", "b"]);
    expect(toggled(["a", "b"], "a")).toEqual(["b"]);
    const store = createCanvasStore();
    store.select("a");
    store.toggle("b");
    expect(store.getState().selection).toEqual(["a", "b"]);
  });

  it("selects many without repeats", () => {
    const store = createCanvasStore();
    store.selectMany(["a", "b", "a"]);
    expect(store.getState().selection).toEqual(["a", "b"]);
  });

  it("selects what a marquee caught, or adds it with Shift", () => {
    expect(merged(["a"], ["b", "a", "c"])).toEqual(["a", "b", "c"]);
    const store = createCanvasStore({ selection: ["a"] });
    store.beginMarquee({ x: 10, y: 10 });
    store.moveMarquee({ x: -10, y: 30 });
    expect(marqueeRect(store.getState())).toEqual({ x: -10, y: 10, width: 20, height: 20 });
    store.endMarquee(["b"], true);
    expect(store.getState().selection).toEqual(["a", "b"]);
    expect(store.getState().marquee).toBeNull();
    expect(marqueeRect(store.getState())).toBeNull();
    store.beginMarquee({ x: 0, y: 0 });
    store.endMarquee(["c"], false);
    expect(store.getState().selection).toEqual(["c"]);
  });

  it("ignores a marquee move with no marquee", () => {
    const store = createCanvasStore();
    const before = store.getState();
    store.moveMarquee({ x: 1, y: 1 });
    expect(store.getState()).toBe(before);
  });
});

describe("the canvas store's view", () => {
  it("pans, steps, wheels and fits", () => {
    const store = createCanvasStore();
    store.panBy({ x: 5, y: -5 });
    expect(store.getState().viewport).toEqual({ x: 5, y: -5, scale: 1 });
    store.zoomStep(1, { x: 0, y: 0 });
    expect(store.getState().viewport.scale).toBe(1.25);
    store.zoomTo(2, { x: 0, y: 0 });
    expect(store.getState().viewport.scale).toBe(2);
    store.zoomWheel(200, { x: 0, y: 0 });
    expect(store.getState().viewport.scale).toBeLessThan(2);
    store.fit({ x: 0, y: 0, width: 100, height: 100 }, { width: 400, height: 400 });
    expect(screenToWorld(store.getState().viewport, { x: 200, y: 200 })).toEqual({ x: 50, y: 50 });
    store.setViewport({ x: 1, y: 2, scale: 3 });
    expect(store.getState().viewport).toEqual({ x: 1, y: 2, scale: 3 });
  });

  it("opens and closes focused mode", () => {
    const store = createCanvasStore();
    store.setFocus("garment");
    expect(store.getState().focus).toBe("garment");
    store.setFocus(null);
    expect(store.getState().focus).toBeNull();
  });
});

describe("the canvas store's subscription", () => {
  it("tells a listener about a change and not about a no-op, until it unsubscribes", () => {
    const store = createCanvasStore();
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    store.select("a");
    store.select("a");
    store.setFocus(null);
    store.setViewport(store.getState().viewport);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    store.select("b");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps an unchanged part of the state the same object, so a selector is stable", () => {
    const store = createCanvasStore();
    const selection = store.getState().selection;
    store.panBy({ x: 1, y: 0 });
    expect(store.getState().selection).toBe(selection);
    store.beginMarquee({ x: 0, y: 0 });
    store.endMarquee([], false);
    expect(store.getState().selection).toBe(selection);
  });
});
