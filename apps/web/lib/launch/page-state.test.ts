import { describe, expect, it } from "vitest";
import { board, designBoard, link, project } from "./fixtures/canvas";
import { emptyStateOf, launchPageState } from "./index";

const pack = () =>
  project([designBoard("design"), board("flat-lay", "mockup"), board("floodlit", "ai_image"), board("art", "artboard")], [
    link("e1", "design", "flat-lay"),
    link("e2", "design", "floodlit"),
  ]);

describe("the empty state of the canvas", () => {
  it("names the one action that fills an empty canvas", () => {
    const empty = emptyStateOf({ boards: [], edges: [] });

    expect(empty?.title).toBe("Nothing on this canvas yet");
    expect(empty?.action).toBe("Add a Design board");
    expect(empty?.ruleId).toBe("R-GAP-000");
  });

  it("asks for a design board on a canvas that has boards but no design", () => {
    const empty = emptyStateOf({ boards: [board("art", "artboard")], edges: [] });

    expect(empty?.title).toBe("No design on the canvas");
    expect(empty?.action).toBe("Add a Design board");
  });

  it("shows nothing once a design board is on the canvas", () => {
    expect(emptyStateOf({ boards: [designBoard("design")], edges: [] })).toBeNull();
  });
});

describe("what the page works out before it draws", () => {
  it("takes the rail panel, the tool and the zoom from the address", () => {
    const state = launchPageState({ query: { panel: "brand", tool: "text", zoom: "150" }, project: pack() });

    expect(state.rail).toBe("brand");
    expect(state.tool).toBe("text");
    expect(state.zoom).toBe(150);
  });

  it("uses the project's own unit until the address names one", () => {
    expect(launchPageState({ query: {}, project: project([], [], { units: "mm" }) }).unit).toBe("mm");
    expect(launchPageState({ query: { unit: "in" }, project: project([], [], { units: "mm" }) }).unit).toBe("in");
  });

  it("selects the board the address names and opens that kind's inspector", () => {
    const state = launchPageState({ query: { board: "floodlit" }, project: pack() });

    expect(state.selection?.board.id).toBe("floodlit");
    expect(state.selection?.image).toBe(false);
    expect(state.inspector).toBe("board-ai-image");
    expect(state.taskBar?.title).toBe("AI image board");
  });

  it("leaves the inspector to the project for a board the shell draws itself", () => {
    expect(launchPageState({ query: { board: "art" }, project: pack() }).inspector).toBeNull();
    expect(launchPageState({ query: { board: "design" }, project: pack() }).inspector).toBeNull();
  });

  it("selects nothing for a board that is not on the canvas", () => {
    const state = launchPageState({ query: { board: "gone" }, project: pack() });

    expect(state.selection).toBeNull();
    expect(state.taskBar).toBeNull();
    expect(state.inspector).toBeNull();
  });

  it("says why a selected board cannot be run, so the lock is on the screen and not only in the code", () => {
    const loose = project([board("scene", "ai_image")], []);
    const state = launchPageState({ query: { board: "scene" }, project: loose });

    expect(state.lockNote).toMatch(/Connect a Design board first/);
  });

  it("says nothing about the lock for a board a design already feeds, or for one nothing feeds", () => {
    expect(launchPageState({ query: { board: "floodlit" }, project: pack() }).lockNote).toBeNull();
    expect(launchPageState({ query: { board: "design" }, project: pack() }).lockNote).toBeNull();
  });

  it("selects the board's picture when the address asks for it", () => {
    const state = launchPageState({ query: { board: "floodlit", image: "1" }, project: pack() });

    expect(state.selection?.image).toBe(true);
    expect(state.taskBar?.title).toBe("AI image picture");
  });
});
