import { describe, expect, it } from "vitest";
import type { BoardView, Graph } from "@/lib/launch";
import { estimateFlow, flowRunLabel } from "./cost";
import { canvasOfTemplate, withBoard } from "./fixtures/canvas";
import { runFlow, type FlowRunReport } from "./run";
import { STUB_COSTS, stubCapability, stubMeter, stubRecorder } from "./stub";
import { runnableIds } from "./topology";
import { capabilityOf } from "./capabilities";
import { memoryPorts } from "./real/fixtures";
import { RECORDED_VIDEO_LINE } from "./real/mockup";
import { flowRegistry } from "./real/registry";

/**
 * THE TWO ACCEPTANCE TESTS OF F-L4, word for word:
 *
 *   * "The Club kit launch pack produces 14 assets in under 10 minutes."
 *   * "Swapping the design and pressing Run all regenerates every output without re-entering
 *     prompts."
 *
 * The second is the one that matters. A flow whose rerun needs the prompts typed again is not a
 * flow, it is a folder of screenshots, and the whole point of the board model is that every board
 * keeps its own settings. So this file proves it the only way worth proving it: run the pack, keep
 * every output, change nothing but the Design board's version, run it again, and check that
 *
 *   1. not one board's settings changed between the two runs;
 *   2. every board ran again, and every output is a different file, because the garment is;
 *   3. the second run asked for nothing from the person: the same graph, the same press.
 *
 * Both runs use the deterministic stub, so there is no paid call and no clock in either.
 */

const graphWithOutputs = (graph: Graph, report: FlowRunReport): Graph =>
  report.lines.reduce(
    (left, line) =>
      line.fileId === null ? left : withBoard(left, line.boardId, { outputFileId: line.fileId, status: "ready", lastCostCredits: line.credits }),
    graph,
  );

const settingsOf = (graph: Graph): Readonly<Record<string, unknown>> =>
  Object.fromEntries(graph.boards.map((board: BoardView) => [board.id, board.settings]));

const runAll = async (graph: Graph, failing: readonly string[] = []) => {
  const recorder = stubRecorder();
  const meter = stubMeter({ balance: 500 });
  const report = await runFlow(
    { capability: stubCapability({ failing }), meter, recorder },
    graph,
    { from: null, scope: "all" },
    STUB_COSTS,
  );
  return { report, recorder, meter };
};

describe("the Club kit launch pack", () => {
  it("makes the fourteen assets 07 counts, from one design, with the stubs", async () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const { report } = await runAll(graph);

    expect(report.state).toBe("done");
    expect(report.assets).toBe(14);
    expect(report.lines.filter((line) => line.state === "ready")).toHaveLength(14);
    expect(report.lines.some((line) => line.state === "failed" || line.state === "skipped")).toBe(false);
  });

  it("shows what the run will cost and what it will make before anything is spent", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const estimate = estimateFlow(graph, { from: null, scope: "all" }, STUB_COSTS);

    // Three of the nine mockups are the teamwear scenes a model makes, so they cost credits and
    // the other eleven boards do not. The figure itself is the platform's credit price.
    expect(estimate.lines.filter((line) => line.generation === "model")).toHaveLength(3);
    expect(estimate.credits).toBe(3);
    expect(estimate.assets).toBe(14);
    expect(flowRunLabel(estimate)).toBe("Run all (14 assets, 3 credits)");
    expect(estimate.note).toContain("placeholder");
  });

  it("runs every board after the boards that feed it", async () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const order = runnableIds(graph, { from: null, scope: "all" });

    for (const edge of graph.edges) {
      if (!order.includes(edge.fromBoardId) || !order.includes(edge.toBoardId)) continue;
      expect(order.indexOf(edge.fromBoardId), `${edge.fromBoardId} before ${edge.toBoardId}`).toBeLessThan(order.indexOf(edge.toBoardId));
    }
  });

  it("counts the fourteen outputs the spec names: six renders, three scenes, four posts and a clip", async () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const { report } = await runAll(graph);
    const byKind = report.lines.reduce<Record<string, number>>((count, line) => ({ ...count, [line.kind]: (count[line.kind] ?? 0) + 1 }), {});

    expect(byKind).toEqual({ mockup: 7, ai_image: 3, marketing: 4 });
    expect(report.lines.filter((line) => line.format === "mp4")).toHaveLength(1);
  });
});

describe("swapping the design and pressing Run all", () => {
  it("regenerates every output without one prompt being entered again", async () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack", { designVersion: 7 });
    const first = await runAll(graph);
    const after = graphWithOutputs(graph, first.report);

    // The one thing a person does: the Design board now points at the new version. Nothing else on
    // the canvas is touched -- no prompt, no scene, no aspect, no board added or removed.
    const swapped = withBoard(after, "design", { inputVersion: 8 });
    const second = await runAll(swapped);

    expect(settingsOf(swapped)).toEqual(settingsOf(graph));
    expect(second.report.assets).toBe(14);
    expect(second.report.state).toBe("done");

    const before = new Map(first.report.lines.map((line) => [line.boardId, line.fileId]));
    for (const line of second.report.lines) {
      expect(line.state, line.boardId).toBe("ready");
      expect(line.fileId, line.boardId).not.toBeNull();
      // A new garment version means a new picture on every board, which is what "regenerates" means.
      expect(line.fileId, line.boardId).not.toBe(before.get(line.boardId));
    }
  });

  it("asks the person for nothing: the second run is the same press on the same canvas", async () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack", { designVersion: 7 });
    const first = await runAll(graph);
    const swapped = withBoard(graphWithOutputs(graph, first.report), "design", { inputVersion: 9 });

    expect(runnableIds(swapped, { from: null, scope: "all" })).toEqual(runnableIds(graph, { from: null, scope: "all" }));
    expect(estimateFlow(swapped, { from: null, scope: "all" }, STUB_COSTS).credits).toBe(
      estimateFlow(graph, { from: null, scope: "all" }, STUB_COSTS).credits,
    );
  });

  it("keeps every prompt when only the boards downstream of one are rerun", async () => {
    const { graph } = canvasOfTemplate("brand-drop-pack", { designVersion: 3 });
    const first = await runAll(graph);
    const after = graphWithOutputs(graph, first.report);
    const downstream = await runFlow(
      { capability: stubCapability(), meter: stubMeter({ balance: 500 }), recorder: stubRecorder() },
      after,
      { from: "lifestyle-city", scope: "downstream" },
      STUB_COSTS,
    );

    expect(downstream.lines.map((line) => line.boardId)).toEqual(["lifestyle-city", "drop-post", "clip-orbit"]);
    expect(downstream.lines.every((line) => line.state === "ready")).toBe(true);
    expect(settingsOf(after)).toEqual(settingsOf(graph));
  });
});

/**
 * THE SAME PACK, RUN FOR REAL (decision 0133).
 *
 * The tests above prove the engine with the stub. These prove the production registry: the free
 * renders and the posts are drawn by the platform's own renderers from a real garment, the three
 * teamwear scenes go through L3's shoot (with its own stub provider, so nothing is called), and
 * every file a board names is a file that was stored. The one board that does not finish is the
 * turntable, which is recorded in the browser from the 3D view and says so.
 */
describe("the Club kit launch pack, run through the real registry", () => {
  const runReal = async (graph: Graph) => {
    const memory = memoryPorts();
    const report = await runFlow(
      { capability: capabilityOf(flowRegistry(graph, memory.ports)), meter: stubMeter({ balance: 500 }), recorder: stubRecorder() },
      graph,
      { from: null, scope: "all" },
      STUB_COSTS,
    );
    return { report, memory };
  };

  it("draws the six renders and the four posts for real, makes the three scenes, and names the one it cannot make", async () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const { report, memory } = await runReal(graph);

    const ready = report.lines.filter((line) => line.state === "ready");
    expect(ready).toHaveLength(13);
    expect(report.assets).toBe(13);
    for (const line of ready) {
      const stored = memory.files.get(line.fileId!);
      expect(stored, line.boardId).toBeDefined();
      // The platform's own boards are the platform's pictures; a scene is the model's, labelled.
      expect([line.boardId, stored?.provenance]).toEqual([line.boardId, line.kind === "ai_image" ? "generated" : "deterministic"]);
    }
    const turntable = report.lines.find((line) => line.boardId === "turntable");
    expect(turntable).toMatchObject({ state: "failed", reason: RECORDED_VIDEO_LINE, credits: 0 });
  }, 120_000);

  it("swapping the design and pressing Run all redraws every board from the new version, with no prompt entered again", async () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack", { designVersion: 7 });
    const first = await runReal(graph);
    const swapped = withBoard(graphWithOutputs(graph, first.report), "design", { inputVersion: 8 });
    const second = await runReal(swapped);

    expect(settingsOf(swapped)).toEqual(settingsOf(graph));
    expect(second.report.assets).toBe(13);
    // Every render was drawn from version 8: the renderer wrote the version it really drew from.
    expect(second.memory.versions.map((one) => one.version)).toEqual(first.memory.versions.map(() => 8));
    expect(first.memory.versions.every((one) => one.version === 7)).toBe(true);
  }, 120_000);
});

describe("every one of the six packs", () => {
  it("makes exactly the assets 07 counts for it, with the stubs", async () => {
    for (const slug of ["club-kit-launch-pack", "brand-drop-pack", "team-store-promo", "shopify-product-listing", "colourway-set", "sponsor-pack"]) {
      const { graph, plan } = canvasOfTemplate(slug);
      const { report } = await runAll(graph);

      expect([slug, report.assets]).toEqual([slug, plan.assets]);
      expect([slug, report.state]).toEqual([slug, "done"]);
    }
  });
});
