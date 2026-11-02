import { describe, expect, it } from "vitest";
import { affordable, type BoardView } from "@/lib/launch";
import { boardAssets, boardFormat, boardGeneration, chargeUnits, estimateFlow, flowBoardCost, flowCostSource, flowRunLabel, MAX_PER_BOARD } from "./cost";
import { canvasOfTemplate, withBoard } from "./fixtures/canvas";
import { STUB_COSTS } from "./stub";
import { FLOW_GAP_RULE } from "./types";

const board = (over: Partial<BoardView> = {}): BoardView => ({
  id: "one",
  kind: "mockup",
  name: "One",
  at: { x: 0, y: 0 },
  size: { width: 1080, height: 1080 },
  settings: {},
  inputVersion: null,
  outputFileId: null,
  outputRole: "asset",
  status: "empty",
  lastCostCredits: null,
  ruleId: FLOW_GAP_RULE,
  ...over,
});

describe("how a board says it is made", () => {
  it("lets a board's own settings make it a model scene, because the spec's mockup table does", () => {
    expect(boardGeneration(board({ settings: { generation: "model" } }))).toBe("model");
  });

  it("will not let written settings make an AI board free, because the client writes settings", () => {
    expect(boardGeneration(board({ kind: "ai_image", settings: { generation: "deterministic" } }))).toBe("model");
    expect(boardGeneration(board({ kind: "ai_video", settings: { generation: "deterministic" } }))).toBe("model");
    expect(flowBoardCost(board({ kind: "ai_image", settings: { generation: "deterministic" } }), STUB_COSTS)).toBe(1);
  });

  it("reads a board nobody made from a template by its kind", () => {
    expect(boardGeneration(board())).toBe("deterministic");
    expect(boardGeneration(board({ kind: "ai_video" }))).toBe("model");
    expect(boardGeneration(board({ settings: { generation: "invented" } }))).toBe("deterministic");
  });

  it("reads the format and the asset count off the board, with sensible fallbacks", () => {
    expect(boardFormat(board({ settings: { format: "pdf" } }))).toBe("pdf");
    expect(boardFormat(board({ settings: { format: "tiff" } }))).toBe("png");
    expect(boardFormat(board({ kind: "ai_video" }))).toBe("mp4");
    expect(boardAssets(board())).toBe(1);
    expect(boardAssets(board({ settings: { assets: 3 } }))).toBe(3);
    expect(boardAssets(board({ settings: { assets: -4 } }))).toBe(0);
  });
});

describe("what one board costs", () => {
  it("costs nothing when the platform draws it", () => {
    expect(flowBoardCost(board(), STUB_COSTS)).toBe(0);
    expect(flowBoardCost(board({ kind: "marketing" }), STUB_COSTS)).toBe(0);
    expect(flowBoardCost(board({ kind: "info_card" }), STUB_COSTS)).toBe(0);
  });

  it("counts no more of an output than a board may claim to make", () => {
    expect(chargeUnits(board({ settings: { count: 9_000 } }))).toBe(MAX_PER_BOARD);
    expect(chargeUnits(board({ settings: { count: 0 } }))).toBe(1);
    expect(boardAssets(board({ settings: { assets: 9_000 } }))).toBe(MAX_PER_BOARD);
  });

  it("costs the credit price for a mockup board with an AI scene, which L1's own price would miss", () => {
    const scene = board({ settings: { generation: "model", scene: "team-line-up-11" } });

    expect(flowBoardCost(scene, flowCostSource({ perGeneratedBoard: 4, note: "n", ruleId: FLOW_GAP_RULE }))).toBe(4);
  });

  it("multiplies by the image count a shoot asked for", () => {
    const shoot = board({ kind: "ai_image", settings: { count: 4 } });

    expect(flowBoardCost(shoot, flowCostSource({ perGeneratedBoard: 2, note: "n", ruleId: FLOW_GAP_RULE }))).toBe(8);
  });

  it("prices a clip per second once a per-second figure is configured, and as one picture before that", () => {
    const clip = board({ kind: "ai_video", settings: { seconds: 6 } });

    expect(flowBoardCost(clip, flowCostSource({ perGeneratedBoard: 1, note: "n", ruleId: FLOW_GAP_RULE }, 3))).toBe(18);
    expect(flowBoardCost(clip, flowCostSource({ perGeneratedBoard: 1, note: "n", ruleId: FLOW_GAP_RULE }))).toBe(1);
  });
});

describe("the estimate shown before a run", () => {
  it("counts the credits and the assets of the whole canvas", () => {
    const { graph } = canvasOfTemplate("brand-drop-pack");
    const estimate = estimateFlow(graph, { from: null, scope: "all" }, STUB_COSTS);

    // Four lifestyle scenes and two clips are made by a model; the other ten boards are not.
    expect(estimate.lines.filter((line) => line.generation === "model")).toHaveLength(6);
    expect(estimate.credits).toBe(6);
    expect(estimate.assets).toBe(16);
    expect(estimate.blocked).toBe(0);
  });

  it("says plainly that a clip has no per-second price yet, rather than quietly charging as if it had", () => {
    const { graph } = canvasOfTemplate("brand-drop-pack");

    expect(estimateFlow(graph, { from: null, scope: "all" }, STUB_COSTS).note).toContain("No per-second price is set");
    expect(estimateFlow(graph, { from: null, scope: "all" }, flowCostSource(STUB_COSTS, 2)).note).not.toContain("No per-second price");
  });

  it("charges nothing for a board that cannot run, and counts it as blocked", () => {
    const { graph } = canvasOfTemplate("brand-drop-pack");
    // Take the design board away: nothing has a garment behind it any more.
    const orphaned = { boards: graph.boards.filter((one) => one.id !== "design"), edges: graph.edges.filter((one) => one.fromBoardId !== "design") };
    const estimate = estimateFlow(orphaned, { from: null, scope: "all" }, STUB_COSTS);

    expect(estimate.credits).toBe(0);
    expect(estimate.assets).toBe(0);
    expect(estimate.blocked).toBe(estimate.lines.length);
    expect(estimate.lines[0]?.blocked).toContain("Connect a board into this Mockup board first");
    expect(estimate.lines.find((line) => line.kind === "marketing")?.blocked).toContain("Connect a Design board first");
  });

  it("leaves out a board that is not on the canvas at all", () => {
    const { graph } = canvasOfTemplate("sponsor-pack");
    const missing = { boards: graph.boards, edges: graph.edges };

    expect(estimateFlow(missing, { from: "gone", scope: "board" }, STUB_COSTS).lines).toEqual([]);
  });

  it("says on the button what the run makes and what it costs", () => {
    const { graph } = canvasOfTemplate("shopify-product-listing");
    const free = estimateFlow(graph, { from: null, scope: "all" }, STUB_COSTS);

    expect(flowRunLabel(free)).toBe("Run all (7 assets, free)");
    expect(flowRunLabel(estimateFlow(graph, { from: "gone", scope: "board" }, STUB_COSTS))).toBe("Nothing to run");
  });

  it("says nothing can run when every board is blocked", () => {
    const { graph } = canvasOfTemplate("sponsor-pack");
    const orphaned = { boards: graph.boards.filter((one) => one.id !== "design"), edges: [] };

    expect(flowRunLabel(estimateFlow(orphaned, { from: null, scope: "all" }, STUB_COSTS))).toBe("Nothing can run yet");
  });

  it("is checked against the brand's balance by L1's own rule, not a second one", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const estimate = estimateFlow(graph, { from: null, scope: "all" }, STUB_COSTS);

    expect(affordable({ ...estimate, note: estimate.note, ruleId: estimate.ruleId }, 2).affordable).toBe(false);
    expect(affordable({ ...estimate, note: estimate.note, ruleId: estimate.ruleId }, 3).affordable).toBe(true);
    expect(affordable({ ...estimate, note: estimate.note, ruleId: estimate.ruleId }, null).affordable).toBe(false);
  });

  it("counts a board that has already run exactly as it counts one that has not", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const ran = withBoard(graph, "line-up", { status: "ready", outputFileId: "11111111-0000-4000-8000-111111111111" });

    expect(estimateFlow(ran, { from: null, scope: "all" }, STUB_COSTS).credits).toBe(3);
  });
});
