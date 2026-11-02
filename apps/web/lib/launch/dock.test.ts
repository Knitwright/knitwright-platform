import { describe, expect, it } from "vitest";
import {
  clampZoom,
  DEFAULT_ZOOM,
  DOCK_TOOLS,
  dockTool,
  fitZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  PROMPT_PLACEHOLDER,
  TOOLS,
  toolKeyTarget,
  zoomIn,
  zoomOut,
} from "./index";

describe("the tool dock", () => {
  it("is the spec's seven tools, in its order", () => {
    expect(DOCK_TOOLS).toEqual(["select", "frame", "shape", "pen", "text", "comment", "ai"]);
  });

  it("gives every tool a word and a sentence saying what it does", () => {
    for (const id of DOCK_TOOLS) {
      expect(TOOLS[id].label.length).toBeGreaterThan(0);
      expect(TOOLS[id].hint).toMatch(/\.$/);
    }
  });

  it("holds the words of the prompt pill the spec gives", () => {
    expect(PROMPT_PLACEHOLDER).toBe("Describe what you want to create");
  });

  it("reads the tool an address names, and falls back to Select", () => {
    expect(dockTool("pen")).toBe("pen");
    expect(dockTool(["text", "pen"])).toBe("text");
    expect(dockTool("brush")).toBe("select");
    expect(dockTool(undefined)).toBe("select");
  });

  it("steps and wraps with the arrow keys, and jumps to the ends with Home and End", () => {
    expect(toolKeyTarget("select", "ArrowRight")).toBe("frame");
    expect(toolKeyTarget("ai", "ArrowDown")).toBe("select");
    expect(toolKeyTarget("select", "ArrowLeft")).toBe("ai");
    expect(toolKeyTarget("frame", "ArrowUp")).toBe("select");
    expect(toolKeyTarget("pen", "Home")).toBe("select");
    expect(toolKeyTarget("pen", "End")).toBe("ai");
    expect(toolKeyTarget("pen", "Enter")).toBeNull();
  });
});

describe("the zoom", () => {
  it("holds a per-cent inside the range and rounds it", () => {
    expect(clampZoom(133.4)).toBe(133);
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(10_000)).toBe(MAX_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(DEFAULT_ZOOM);
  });

  it("steps up and down through the steps, and stops at each end", () => {
    expect(zoomIn(100)).toBe(150);
    expect(zoomIn(400)).toBe(MAX_ZOOM);
    expect(zoomOut(100)).toBe(75);
    expect(zoomOut(10)).toBe(MIN_ZOOM);
  });

  it("fits a canvas into the space on screen, and never blows a board up to do it", () => {
    expect(fitZoom({ width: 2000, height: 1000 }, { width: 1000, height: 1000 })).toBe(50);
    expect(fitZoom({ width: 100, height: 100 }, { width: 1000, height: 1000 })).toBe(100);
    expect(fitZoom({ width: 0, height: 0 }, { width: 1000, height: 1000 })).toBe(DEFAULT_ZOOM);
  });
});
