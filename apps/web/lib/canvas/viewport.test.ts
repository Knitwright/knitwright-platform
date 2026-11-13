import { describe, expect, it } from "vitest";
import {
  boundsOf,
  clampScale,
  fitTo,
  HOME,
  intersects,
  MAX_SCALE,
  MIN_SCALE,
  panBy,
  rectFromPoints,
  screenToWorld,
  stepZoom,
  visibleRect,
  wheelZoom,
  worldToScreen,
  zoomAt,
  zoomPercent,
} from "./viewport";

const SCREEN = { width: 1000, height: 600 };

describe("screen and world", () => {
  it("are the same at the home view", () => {
    expect(screenToWorld(HOME, { x: 40, y: 70 })).toEqual({ x: 40, y: 70 });
    expect(worldToScreen(HOME, { x: 40, y: 70 })).toEqual({ x: 40, y: 70 });
  });

  it("round-trip through a panned and zoomed view", () => {
    const view = { x: 120, y: -40, scale: 0.5 };
    const world = screenToWorld(view, { x: 220, y: 60 });
    expect(world).toEqual({ x: 200, y: 200 });
    expect(worldToScreen(view, world)).toEqual({ x: 220, y: 60 });
  });
});

describe("zooming", () => {
  it("keeps the world point under the pointer where it was", () => {
    const view = { x: 30, y: 20, scale: 1 };
    const pointer = { x: 400, y: 300 };
    const before = screenToWorld(view, pointer);
    const after = zoomAt(view, pointer, 2.5);
    expect(after.scale).toBe(2.5);
    const again = screenToWorld(after, pointer);
    expect(again.x).toBeCloseTo(before.x, 9);
    expect(again.y).toBeCloseTo(before.y, 9);
  });

  it("stays between 10% and 400% (10 'Canvas (editor)')", () => {
    expect(MIN_SCALE).toBe(0.1);
    expect(MAX_SCALE).toBe(4);
    expect(clampScale(0.01)).toBe(0.1);
    expect(clampScale(9)).toBe(4);
    expect(zoomAt(HOME, { x: 0, y: 0 }, 100).scale).toBe(4);
  });

  it("steps through round figures with + and −, about the point given", () => {
    expect(stepZoom(HOME, 1, { x: 0, y: 0 }).scale).toBe(1.25);
    expect(stepZoom(HOME, -1, { x: 0, y: 0 }).scale).toBe(0.75);
    expect(stepZoom({ x: 0, y: 0, scale: 0.8 }, 1, { x: 0, y: 0 }).scale).toBe(1);
    expect(stepZoom({ x: 0, y: 0, scale: 4 }, 1, { x: 0, y: 0 }).scale).toBe(4);
    expect(stepZoom({ x: 0, y: 0, scale: 0.1 }, -1, { x: 0, y: 0 }).scale).toBe(0.1);
  });

  it("zooms in on a wheel turned up and out on one turned down, smoothly", () => {
    expect(wheelZoom(HOME, -100, { x: 0, y: 0 }).scale).toBeGreaterThan(1);
    expect(wheelZoom(HOME, 100, { x: 0, y: 0 }).scale).toBeLessThan(1);
    expect(wheelZoom(HOME, 0, { x: 0, y: 0 }).scale).toBe(1);
  });

  it("reads as a whole percentage", () => {
    expect(zoomPercent({ x: 0, y: 0, scale: 0.333 })).toBe(33);
  });
});

describe("panning", () => {
  it("moves the view by screen pixels whatever the zoom", () => {
    expect(panBy({ x: 10, y: 10, scale: 3 }, { x: -5, y: 20 })).toEqual({ x: 5, y: 30, scale: 3 });
  });
});

describe("fit to content", () => {
  it("centres the boards and never zooms past 100%", () => {
    const view = fitTo({ x: 0, y: 0, width: 100, height: 100 }, SCREEN, 40);
    expect(view.scale).toBe(1);
    expect(worldToScreen(view, { x: 50, y: 50 })).toEqual({ x: 500, y: 300 });
  });

  it("zooms out until the widest side fits inside the padding", () => {
    const view = fitTo({ x: -1000, y: 0, width: 4000, height: 1000 }, SCREEN, 50);
    expect(view.scale).toBeCloseTo(900 / 4000, 9);
    const left = worldToScreen(view, { x: -1000, y: 0 });
    expect(left.x).toBeCloseTo(50, 9);
  });

  it("goes home on an empty canvas", () => {
    expect(fitTo(null, SCREEN, 40)).toEqual(HOME);
  });
});

describe("rectangles", () => {
  it("bound a set of boxes, or nothing", () => {
    expect(boundsOf([])).toBeNull();
    expect(
      boundsOf([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: -5, y: 20, width: 10, height: 10 },
      ]),
    ).toEqual({ x: -5, y: 0, width: 15, height: 30 });
  });

  it("come from two corners in either order", () => {
    expect(rectFromPoints({ x: 10, y: 50 }, { x: -10, y: 20 })).toEqual({ x: -10, y: 20, width: 20, height: 30 });
  });

  it("overlap only when they share area", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(intersects(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(intersects(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    expect(intersects(a, { x: 0, y: 11, width: 1, height: 1 })).toBe(false);
  });

  it("give the world rectangle the screen shows, with a margin", () => {
    expect(visibleRect({ x: -100, y: 0, scale: 2 }, SCREEN, 0)).toEqual({ x: 50, y: 0, width: 500, height: 300 });
    expect(visibleRect(HOME, SCREEN, 100)).toEqual({ x: -100, y: -100, width: 1200, height: 800 });
  });
});
