import { describe, expect, it } from "vitest";
import { RAIL_ITEMS } from "@/lib/launch";
import { CLOSED, entryFor, flyoutTitle, isMoreApp, MORE_APPS, pressed, RAIL_ENTRIES, railMove, railTab, readFlyout } from "./index";

describe("the editor's labelled rail", () => {
  it("is the screen map's eleven items, in its order", () => {
    expect(RAIL_ENTRIES.map((entry) => entry.label)).toEqual([
      "Products",
      "Templates",
      "Text",
      "Illustrations",
      "AI Gallery",
      "Mockups",
      "Uploads",
      "More",
      "Learn",
      "Layers",
      "Help",
    ]);
  });

  it("keeps every launch panel reachable: on the rail, through More, or inside Layers", () => {
    const onRail = RAIL_ENTRIES.flatMap((entry) => (entry.opens.kind === "panel" ? [entry.opens.id] : []));
    const inMore = MORE_APPS.flatMap((app) => ("opens" in app ? [app.opens.id] : []));
    // Layers is the editor's own flyout, and it mounts the launch layers panel under the board list.
    expect(new Set([...onRail, ...inMore, "layers"])).toEqual(new Set(RAIL_ITEMS));
  });

  it("lights the item a flyout belongs to, and More for a panel only More opens", () => {
    expect(entryFor({ kind: "own", id: "products" })).toBe("products");
    expect(entryFor({ kind: "panel", id: "elements" })).toBe("illustrations");
    expect(entryFor({ kind: "panel", id: "brand" })).toBe("more");
    expect(entryFor({ kind: "panel", id: "layers" })).toBeNull();
    expect(entryFor(CLOSED)).toBeNull();
    expect(isMoreApp({ kind: "panel", id: "photos" })).toBe(true);
    expect(isMoreApp({ kind: "panel", id: "mockups" })).toBe(false);
  });

  it("opens an item's flyout, and closes it when the item is pressed again", () => {
    expect(pressed(CLOSED, "mockups")).toEqual({ kind: "panel", id: "mockups" });
    expect(pressed({ kind: "panel", id: "mockups" }, "mockups")).toEqual(CLOSED);
    expect(pressed({ kind: "panel", id: "brand" }, "more")).toEqual(CLOSED);
    expect(pressed({ kind: "own", id: "help" }, "layers")).toEqual({ kind: "own", id: "layers" });
    expect(pressed(CLOSED, "nothing" as never)).toEqual(CLOSED);
  });

  it("titles a flyout with the rail's word or the app's name", () => {
    expect(flyoutTitle({ kind: "panel", id: "ai-image" })).toBe("AI Gallery");
    expect(flyoutTitle({ kind: "panel", id: "assistant" })).toBe("Chat");
    expect(flyoutTitle({ kind: "own", id: "learn" })).toBe("Learn");
    expect(flyoutTitle({ kind: "panel", id: "layers" })).toBe("");
    expect(flyoutTitle(CLOSED)).toBe("");
  });

  it("moves with the arrows, wrapping, and jumps with Home and End", () => {
    expect(railMove("products", "ArrowDown")).toBe("templates");
    expect(railMove("products", "ArrowUp")).toBe("help");
    expect(railMove("help", "ArrowRight")).toBe("products");
    expect(railMove("text", "ArrowLeft")).toBe("templates");
    expect(railMove("text", "Home")).toBe("products");
    expect(railMove("text", "End")).toBe("help");
    expect(railMove("text", "a")).toBeNull();
    expect(railTab("more")).toBe("editor-rail-more");
  });

  it("opens on what the address names, Products by default", () => {
    expect(readFlyout({})).toEqual({ kind: "own", id: "products" });
    expect(readFlyout({ fly: "none" })).toEqual(CLOSED);
    expect(readFlyout({ fly: ["layers"] })).toEqual({ kind: "own", id: "layers" });
    expect(readFlyout({ panel: "mockups" })).toEqual({ kind: "panel", id: "mockups" });
    expect(readFlyout({ panel: "pattern-fills" })).toEqual({ kind: "panel", id: "pattern-fills" });
    expect(readFlyout({ fly: "nonsense", panel: "nonsense" })).toEqual({ kind: "own", id: "products" });
  });
});
