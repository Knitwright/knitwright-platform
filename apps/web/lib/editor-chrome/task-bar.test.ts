import { describe, expect, it } from "vitest";
import { taskBar } from "@/lib/launch";
import { board, ready } from "@/lib/launch/fixtures/canvas";
import { barPlace, BAR_LIFT, contextRows, entryKey, entryLabel, layOutBar, zoomRows } from "./index";

describe("the floating task bar", () => {
  it("names three actions, puts the rest behind 'n more', and pins duplicate, download and delete", () => {
    const bar = taskBar({ board: ready(board("g", "garment")), image: false });
    if (bar === null) throw new Error("a garment board has a bar");
    const laid = layOutBar(bar);
    expect(laid.front.length).toBe(Math.min(3, bar.add.length));
    expect(laid.more.length).toBe(Math.max(0, bar.add.length - 3) + 3);
    expect(laid.moreLabel).toBe(`${laid.more.length} more`);
    expect(laid.duplicate?.id).toBe("duplicate");
    expect(laid.download?.id).toBe("download");
    expect(laid.remove?.id).toBe("remove");
    expect([...laid.front, ...laid.more].map(entryKey)).not.toContain("duplicate");
  });

  it("keeps a picture's own actions in front when there is room", () => {
    const bar = taskBar({ board: board("a", "ai_image"), image: true });
    if (bar === null) throw new Error("a picture has a bar");
    const laid = layOutBar({ ...bar, add: [] }, 5);
    expect(laid.front.map(entryLabel)).toEqual(["Remove background", "Remix", "Generate video", "Upscale", "Reframe"].slice(0, 3));
    expect(laid.more.map(entryLabel)).toEqual(["Upscale", "Reframe"]);
    const none = layOutBar({ title: "x", add: [], items: [] });
    expect(none.moreLabel).toBeNull();
    expect(none.duplicate).toBeNull();
  });

  it("floats above the board's corner and stays on the canvas", () => {
    const view = { x: 100, y: 200, scale: 0.5 };
    const box = { x: 0, y: 0, width: 400, height: 300 };
    expect(barPlace(view, box, { width: 1000, height: 800 }, 300)).toEqual({ left: 100, top: 200 - BAR_LIFT });
    expect(barPlace({ x: -500, y: -500, scale: 1 }, box, { width: 1000, height: 800 }, 300)).toEqual({ left: 8, top: 8 });
    expect(barPlace({ x: 990, y: 400, scale: 1 }, box, { width: 1000, height: 800 }, 300)).toEqual({ left: 692, top: 336 });
  });
});

describe("the zoom and context menus", () => {
  it("offers fit to selection only with something selected", () => {
    expect(zoomRows(false).map((row) => [row.label, row.disabled])).toEqual([
      ["Fit to content", false],
      ["Fit to selection", true],
      ["50%", false],
      ["100%", false],
      ["200%", false],
    ]);
    expect(zoomRows(true)[1]?.disabled).toBe(false);
  });

  it("says why an action cannot be used, rather than hiding it", () => {
    const rows = contextRows(board("m", "mockup"), false);
    const byId = Object.fromEntries(rows.flatMap((row) => ("separator" in row ? [] : [[row.id, row.disabledReason]])));
    expect(byId["duplicate"]).toMatch(/Only owners/);
    expect(byId["download"]).toMatch(/Run this board first/);
    expect(byId["fit-selection"]).toBeNull();
    expect(byId["open-editor"]).toBeUndefined();
  });

  it("opens a garment with a design in the editor", () => {
    const rows = contextRows(ready(board("g", "garment", { settings: { designProjectId: "d1" } })), true);
    const ids = rows.flatMap((row) => ("separator" in row ? [] : [row.id]));
    expect(ids).toContain("open-editor");
    expect(rows.every((row) => "separator" in row || row.disabledReason === null)).toBe(true);
  });
});
