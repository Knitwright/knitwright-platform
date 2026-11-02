import { describe, expect, it } from "vitest";
import { estimateFlow } from "./cost";
import { canvasOfTemplate } from "./fixtures/canvas";
import { runFlow } from "./run";
import { STUB_COSTS, stubCapability, stubMeter, stubRecorder } from "./stub";
import { estimateSummary, runSummary, summaryLine } from "./summary";

/** The `flow-run` panel's three states: nothing run yet, running, and finished. */

const report = async (failing: readonly string[] = [], slug = "club-kit-launch-pack") => {
  const { graph } = canvasOfTemplate(slug);
  const run = await runFlow(
    { capability: stubCapability({ failing }), meter: stubMeter({ balance: 100 }), recorder: stubRecorder() },
    graph,
    { from: null, scope: "all" },
    STUB_COSTS,
  );
  return { graph, run };
};

describe("the panel before anything has been run", () => {
  it("shows what the run will make and cost, and one named action", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const summary = estimateSummary(estimateFlow(graph, { from: null, scope: "all" }, STUB_COSTS));

    expect(summary.state).toBeNull();
    expect(summary.rows).toHaveLength(14);
    expect(summary.rows.every((row) => row.state === "queued")).toBe(true);
    expect(summary.totals.assets).toBe(14);
    expect(summary.totals.spent).toBe(0);
    expect(summary.canExport).toBe(false);
    expect(summary.empty?.action).toBe("Run all");
    expect(summaryLine(summary)).toBe("14 assets to make. Nothing has been spent yet.");
  });

  it("names adding a design when there is nothing on the canvas to run", () => {
    const summary = estimateSummary(estimateFlow({ boards: [], edges: [] }, { from: null, scope: "all" }, STUB_COSTS));

    expect(summary.empty?.action).toBe("Add a Design board");
    expect(summary.rows).toEqual([]);
  });

  it("marks a board that cannot run as such, with the reason, before anything is spent", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const orphaned = { boards: graph.boards.filter((one) => one.id !== "design"), edges: graph.edges.filter((one) => one.fromBoardId !== "design") };
    const summary = estimateSummary(estimateFlow(orphaned, { from: null, scope: "all" }, STUB_COSTS));

    expect(summary.rows.every((row) => row.state === "skipped" && row.reason !== null)).toBe(true);
    expect(summary.totals.assets).toBe(0);
  });
});

describe("the panel after a run", () => {
  it("lists every output with its status, its cost and its format", async () => {
    const { graph, run } = await report();
    const summary = runSummary(graph, run);

    expect(summary.state).toBe("done");
    expect(summary.rows).toHaveLength(14);
    expect(summary.totals).toEqual({ assets: 14, ready: 14, failed: 0, skipped: 0, spent: 3, refunded: 0 });
    expect(summary.byFormat).toEqual([
      { format: "png", count: 13 },
      { format: "mp4", count: 1 },
    ]);
    expect(summary.canExport).toBe(true);
  });

  it("labels every output a model made or touched, as the spec requires", async () => {
    const { graph, run } = await report();
    const summary = runSummary(graph, run);
    const scene = summary.rows.find((row) => row.boardId === "line-up");
    const render = summary.rows.find((row) => row.boardId === "render-front");
    const post = summary.rows.find((row) => row.boardId === "post-square");

    expect(scene?.label).toBe("AI-generated");
    expect(render?.label).toBeNull();
    // The post is built from the line-up scene, so it carries the label too.
    expect(post?.label).toBe("AI-generated");
  });

  it("says in one sentence what came out, what it cost and what did not finish", async () => {
    const { graph, run } = await report(["line-up"]);
    const summary = runSummary(graph, run);

    expect(summary.state).toBe("part_done");
    expect(summaryLine(summary)).toBe("10 assets ready, 2 credits spent, 1 given back, 4 did not finish.");
    expect(summary.rows.filter((row) => row.reason !== null)).toHaveLength(4);
  });

  it("says plainly when nothing was charged", async () => {
    const { graph, run } = await report([], "shopify-product-listing");

    expect(summaryLine(runSummary(graph, run))).toBe("7 assets ready, nothing was charged.");
  });

  it("has nothing to export when nothing finished", async () => {
    const { graph } = canvasOfTemplate("sponsor-pack");
    const run = await runFlow(
      { capability: stubCapability({ failing: ["kit-render", "thank-you", "close-up", "poster"] }), meter: stubMeter(), recorder: stubRecorder() },
      graph,
      { from: null, scope: "all" },
      STUB_COSTS,
    );
    const summary = runSummary(graph, run);

    expect(summary.canExport).toBe(false);
    expect(summary.state).toBe("failed");
    expect(summary.empty).toBeNull();
  });
});
