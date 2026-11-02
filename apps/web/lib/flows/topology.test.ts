import { describe, expect, it } from "vitest";
import type { BoardKind, BoardLink, BoardView, Graph } from "@/lib/launch";
import { canvasOfTemplate } from "./fixtures/canvas";
import { dependentsOf, inputCount, runnableIds, topologicalOrder } from "./topology";
import { FLOW_GAP_RULE } from "./types";

const board = (id: string, kind: BoardKind): BoardView => ({
  id,
  kind,
  name: id,
  at: { x: 0, y: 0 },
  size: { width: 1080, height: 1080 },
  settings: {},
  inputVersion: null,
  outputFileId: null,
  outputRole: "asset",
  status: "empty",
  lastCostCredits: null,
  ruleId: FLOW_GAP_RULE,
});

const link = (from: string, to: string, inputIndex = 1): BoardLink => ({ id: `${from}->${to}`, fromBoardId: from, toBoardId: to, inputIndex });

/** design -> mockup -> scene, and design -> card; scene and card both feed one post (fan-in). */
const fan = (): Graph => ({
  boards: [board("design", "design"), board("mockup", "mockup"), board("scene", "ai_image"), board("card", "info_card"), board("post", "marketing")],
  edges: [link("design", "mockup"), link("mockup", "scene"), link("design", "card"), link("scene", "post", 1), link("card", "post", 2)],
});

describe("the order a flow runs in", () => {
  it("puts a board after both the boards that feed it", () => {
    const graph = fan();
    const order = topologicalOrder(graph);

    expect(order.indexOf("post")).toBeGreaterThan(order.indexOf("scene"));
    expect(order.indexOf("post")).toBeGreaterThan(order.indexOf("card"));
    expect(order.indexOf("scene")).toBeGreaterThan(order.indexOf("mockup"));
    expect(order).toHaveLength(5);
  });

  it("finishes even on a loop somebody wrote straight into the database", () => {
    const graph: Graph = { boards: [board("a", "mockup"), board("b", "marketing")], edges: [link("a", "b"), link("b", "a")] };

    expect([...topologicalOrder(graph)].sort()).toEqual(["a", "b"]);
  });

  it("leaves out the boards that are not run at all", () => {
    expect(runnableIds(fan(), { from: null, scope: "all" })).toEqual(["mockup", "card", "scene", "post"]);
  });

  it("runs one board for Regenerate and the whole branch for Run all downstream", () => {
    const graph = fan();

    expect(runnableIds(graph, { from: "mockup", scope: "board" })).toEqual(["mockup"]);
    expect(runnableIds(graph, { from: "mockup", scope: "downstream" })).toEqual(["mockup", "scene", "post"]);
  });

  it("runs nothing when a scope needs a board and none was given", () => {
    expect(runnableIds(fan(), { from: null, scope: "downstream" })).toEqual([]);
    expect(runnableIds(fan(), { from: null, scope: "board" })).toEqual([]);
  });

  it("leaves out a board that is not on the canvas", () => {
    expect(runnableIds(fan(), { from: "gone", scope: "board" })).toEqual([]);
  });

  it("names every board a failure takes with it", () => {
    expect([...dependentsOf(fan(), "mockup")].sort()).toEqual(["post", "scene"]);
    expect([...dependentsOf(fan(), "post")]).toEqual([]);
  });

  it("counts what feeds a board", () => {
    expect(inputCount(fan(), "post")).toBe(2);
    expect(inputCount(fan(), "design")).toBe(0);
  });
});

describe("the order of a flow template", () => {
  it("runs the Club kit pack's fourteen boards after the design and after their own inputs", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const order = runnableIds(graph, { from: null, scope: "all" });

    expect(order).toHaveLength(14);
    expect(order).not.toContain("design");
    for (const edge of graph.edges) {
      if (!order.includes(edge.fromBoardId)) continue;
      expect(order.indexOf(edge.fromBoardId)).toBeLessThan(order.indexOf(edge.toBoardId));
    }
  });
});
