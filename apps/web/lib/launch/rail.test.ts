import { describe, expect, it } from "vitest";
import { DEFAULT_RAIL_ITEM, parseRail, RAIL, RAIL_ITEMS, railKeyTarget, railPanelId, railTabId } from "./index";

describe("the left icon rail", () => {
  it("is the spec's twelve icons, in its order", () => {
    expect(RAIL_ITEMS).toEqual([
      "templates",
      "text",
      "elements",
      "ai-image",
      "mockups",
      "photos",
      "pattern-fills",
      "likes",
      "uploads",
      "brand",
      "assistant",
      "layers",
    ]);
  });

  it("has no Apps icon, because this platform has no store (owner decision 1)", () => {
    expect(RAIL_ITEMS).not.toContain("apps");
    expect(Object.values(RAIL).map((item) => item.label)).not.toContain("Apps");
  });

  it("gives every icon a word under it", () => {
    for (const id of RAIL_ITEMS) expect(RAIL[id].label.length).toBeGreaterThan(2);
  });

  it("reads the panel an address names, and falls back to Templates", () => {
    expect(parseRail("mockups")).toBe("mockups");
    expect(parseRail(["brand", "mockups"])).toBe("brand");
    expect(parseRail("apps")).toBe(DEFAULT_RAIL_ITEM);
    expect(parseRail(undefined)).toBe("templates");
  });

  it("names a tab and a panel for each icon, so each tab controls a panel that exists", () => {
    expect(railTabId("layers")).toBe("launch-rail-tab-layers");
    expect(railPanelId("layers")).toBe("launch-rail-panel-layers");
  });

  it("steps and wraps with the arrow keys, and jumps to the ends with Home and End", () => {
    expect(railKeyTarget("templates", "ArrowDown")).toBe("text");
    expect(railKeyTarget("layers", "ArrowRight")).toBe("templates");
    expect(railKeyTarget("templates", "ArrowUp")).toBe("layers");
    expect(railKeyTarget("text", "ArrowLeft")).toBe("templates");
    expect(railKeyTarget("brand", "Home")).toBe("templates");
    expect(railKeyTarget("brand", "End")).toBe("layers");
    expect(railKeyTarget("brand", "Escape")).toBeNull();
  });
});
