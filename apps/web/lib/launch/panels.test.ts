import { describe, expect, it } from "vitest";
import { BOARD_KINDS, LAUNCH_PANELS, PANEL_OF_KIND, panelDouble, panelPlaceholder, RAIL_ITEMS } from "./index";

/**
 * The panel contract. L2, L3, L4, L5, L6 and L8 code against it, so this test is what catches a
 * change to it: a panel removed or renamed fails here before it fails in another workstream.
 */

describe("the panels the shell leaves for other workstreams", () => {
  it("is the rail of the spec's Launch shell, then one inspector per board kind, then the run summary", () => {
    expect(LAUNCH_PANELS).toEqual([
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
      "board-mockup",
      "board-ai-image",
      "board-ai-video",
      "board-marketing",
      "board-info-card",
      "flow-run",
    ]);
  });

  it("starts with the twelve rail items, in rail order", () => {
    expect(LAUNCH_PANELS.slice(0, RAIL_ITEMS.length)).toEqual([...RAIL_ITEMS]);
  });

  it("gives every panel a title, a note naming its workstream, and a test id", () => {
    for (const id of LAUNCH_PANELS) {
      const panel = panelPlaceholder(id);
      expect(panel.title.length).toBeGreaterThan(0);
      expect(panel.note).toMatch(/workstream L[2-8]/);
      expect(panel.testId).toBe(`launch-panel-${id}`);
    }
  });

  it("gives every board kind the shell does not draw itself an inspector panel of the contract", () => {
    for (const kind of BOARD_KINDS) {
      const panel = PANEL_OF_KIND[kind];
      if (panel === null) continue;
      expect(LAUNCH_PANELS).toContain(panel);
    }
    // E3 builds the garment inspector, E4 the tech pack and order boards' panels (decision 0145).
    expect(BOARD_KINDS.filter((kind) => PANEL_OF_KIND[kind] === null)).toEqual(["design", "artboard", "garment", "tech_pack", "order"]);
  });
});

describe("the test double of the contract", () => {
  it("records every command a panel asks for, so a panel's own test needs no shell", () => {
    const { commands, calls } = panelDouble();

    commands.addBoard("mockup", { x: 10, y: 20 }, "design-1");
    commands.requestRun("board-1");
    commands.undo();

    expect(calls).toEqual([
      { name: "addBoard", args: ["mockup", { x: 10, y: 20 }, "design-1"] },
      { name: "requestRun", args: ["board-1"] },
      { name: "undo", args: [] },
    ]);
  });

  it("stands in for every command of the contract, so a panel cannot call one that is missing", () => {
    const { commands, calls } = panelDouble();
    const names = Object.keys(commands);

    for (const name of names) (commands as unknown as Record<string, () => void>)[name]?.();

    expect(calls.map((call) => call.name)).toEqual(names);
    expect(names).toHaveLength(18);
  });
});
