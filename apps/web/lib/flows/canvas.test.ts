import { describe, expect, it } from "vitest";
import type { BoardView } from "@/lib/launch";
import { addMenuFor, connectorPath, connectorsOf, connectTargets, CANVAS_MAX, dragTo, extentOf, GRID_PX, inputDot, inputState, isArrowKey, nudge, outputDot, placeOf } from "./canvas";
import { canvasOfTemplate, withBoard } from "./fixtures/canvas";

/**
 * The connectors, the dragging and the keyboard paths of the canvas (spec F-L4). All of it is maths
 * and lists, so the hard part of a node canvas is tested without a browser.
 */

const boardOf = (id: string, graph = canvasOfTemplate("club-kit-launch-pack").graph): BoardView =>
  graph.boards.find((one) => one.id === id) as BoardView;

describe("where a board sits", () => {
  it("snaps to the grid, so boards line up without anybody aiming", () => {
    expect(placeOf({ x: 11, y: -3 })).toEqual({ x: 8, y: 0 });
    expect(GRID_PX).toBe(8);
  });

  it("stays inside what the database will take for a place", () => {
    expect(placeOf({ x: 9_000_000, y: -9_000_000 })).toEqual({ x: CANVAS_MAX, y: -CANVAS_MAX });
  });

  it("ends a drag where the pointer left it, snapped", () => {
    expect(dragTo(boardOf("render-front"), { x: 37, y: -11 })).toEqual({ x: 400, y: -8 });
  });
});

describe("moving a board with the keyboard", () => {
  it("nudges by one grid step, and by ten with Shift held", () => {
    const board = boardOf("render-front");

    expect(nudge(board, "ArrowRight")).toEqual({ x: board.at.x + 8, y: board.at.y });
    expect(nudge(board, "ArrowLeft")).toEqual({ x: board.at.x - 8, y: board.at.y });
    expect(nudge(board, "ArrowUp")).toEqual({ x: board.at.x, y: board.at.y - 8 });
    expect(nudge(board, "ArrowDown", true)).toEqual({ x: board.at.x, y: board.at.y + 80 });
  });

  it("knows which keys are the canvas's own", () => {
    expect(isArrowKey("ArrowUp")).toBe(true);
    expect(isArrowKey("Enter")).toBe(false);
  });
});

describe("the connectors", () => {
  it("leave the right edge and arrive at a numbered input on the left", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const post = boardOf("post-square", graph);

    expect(outputDot(boardOf("design", graph))).toEqual({ x: 1080, y: 540 });
    // Six inputs on a Marketing board, so the dots are spread one seventh apart down the edge.
    expect(inputDot(post, 1).y).toBeLessThan(inputDot(post, 2).y);
    expect(inputDot(post, 1).x).toBe(post.at.x);
    expect(inputDot(post, 99)).toEqual(inputDot(post, 6));
  });

  it("are drawn as a curve that leaves and arrives flat, so a flow reads left to right", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const path = connectorPath(boardOf("design", graph), boardOf("render-front", graph), 1);

    expect(path).toMatch(/^M \d+ \d+ C /);
    expect(path.split(",")).toHaveLength(3);
  });

  it("carry words a screen reader can read, one per connector on the canvas", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const connectors = connectorsOf(graph);

    expect(connectors).toHaveLength(graph.edges.length);
    expect(connectors.find((one) => one.toBoardId === "post-square" && one.inputIndex === 2)?.label).toBe(
      "Team line-up (11) feeds input 2 of \"New kit\" square",
    );
  });

  it("leave out a connector whose board has gone", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const short = { boards: graph.boards.filter((one) => one.id !== "design"), edges: graph.edges };

    expect(connectorsOf(short).some((one) => one.fromBoardId === "design")).toBe(false);
  });
});

describe("the Add… menu on the dot", () => {
  it("offers only the boards the spec's table lets this one feed", () => {
    expect(addMenuFor(boardOf("design")).map((one) => one.kind)).toEqual(["mockup", "ai_image", "marketing", "info_card"]);
    expect(addMenuFor(boardOf("post-square"))).toEqual([]);
  });

  it("says before a board is added whether running it will cost credits", () => {
    const menu = addMenuFor(boardOf("design"));

    expect(menu.find((one) => one.kind === "ai_image")?.paid).toBe(true);
    expect(menu.find((one) => one.kind === "mockup")?.paid).toBe(false);
    expect(menu.every((one) => one.lead.length > 20)).toBe(true);
  });
});

describe("connecting without a mouse", () => {
  it("lists every other board with the input a connector would take", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const targets = connectTargets(graph, "render-front");
    const post = targets.find((one) => one.boardId === "order-story");

    expect(post?.inputIndex).toBe(2);
    expect(post?.blocked).toBeNull();
    expect(targets).toHaveLength(graph.boards.length - 1);
  });

  it("keeps a refused target in the list and says why, in L1's own words", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const targets = connectTargets(graph, "post-square");

    expect(targets.find((one) => one.boardId === "design")?.blocked).toContain("takes nothing from another board");
    expect(targets.find((one) => one.boardId === "render-front")?.blocked).toContain("already connected");
    expect(targets.find((one) => one.boardId === "order-story")?.blocked).toContain("cannot start from a Marketing board");
  });

  it("offers fan-in: a second connector into a board that already has one", () => {
    const { graph } = canvasOfTemplate("brand-drop-pack");

    expect(connectTargets(graph, "white-4-5-front").find((one) => one.boardId === "drop-post")?.inputIndex).toBe(3);
  });
});

describe("what the canvas says about a board", () => {
  it("counts the inputs that are connected, and says when nothing may feed it", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");

    expect(inputState(graph, boardOf("design", graph))).toBe("Nothing feeds this board, by design");
    expect(inputState(graph, boardOf("render-front", graph))).toBe("1 of 1 input connected");
    expect(inputState(graph, boardOf("post-square", graph))).toBe("2 of 6 inputs connected");
    expect(inputState(withBoard(graph, "render-front", {}), boardOf("render-front", graph))).toBe("1 of 1 input connected");
  });

  it("measures the canvas, so the scrolling region is as big as the boards and no bigger", () => {
    const { graph } = canvasOfTemplate("sponsor-pack");
    const extent = extentOf(graph);

    expect(extent.x).toBe(0);
    expect(extent.width).toBeGreaterThan(1080);
    expect(extentOf({ boards: [], edges: [] })).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
