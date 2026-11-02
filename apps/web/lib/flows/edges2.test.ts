import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import { canvasOfTemplate } from "./fixtures/canvas";
import { infoCard } from "./info-card";
import { runFlow } from "./run";
import { latestFlowRun, spendFlowOutput } from "./service";
import { STUB_COSTS, stubCapability, stubMeter, stubRecorder } from "./stub";
import { runSummary, summaryLine } from "./summary";
import { contentsText, exportPaths } from "./zip";

/**
 * The paths a happy run never takes: a row with no rule on it, a charge that was not taken because
 * credits are not enforced, a card with an empty value in it. Each one is a row a database can
 * hold, so each one has to come out as words rather than as a crash.
 */

const BRAND = "11111111-1111-4111-8111-111111111111";
const CANVAS = "33333333-3333-4333-8333-333333333333";
const BOARD = "99999999-9999-4999-8999-999999999999";
const FILE = "66666666-6666-4666-8666-666666666666";
const ENTRY = "77777777-7777-4777-8777-777777777777";

describe("a saved run with gaps in it", () => {
  it("gives a board with no rule on its row the gap rule, and a run with no end no end", async () => {
    const { client } = fakeClient({
      flow_runs: {
        data: {
          id: CANVAS,
          scope: "board",
          from_board_id: BOARD,
          status: "running",
          estimate_credits: 0,
          spent_credits: 0,
          refunded_credits: 0,
          assets: 0,
          template_slug: null,
          created_at: "2026-12-01T10:00:00Z",
          finished_at: null,
          flow_run_boards: [
            { board_id: BOARD, position: 1, status: "running", credits: 0, refunded_credits: 0, assets: 1, format: "png", output_file_id: null, reason: null, rule_id: "" },
          ],
        },
      },
    });
    const run = await latestFlowRun(client, BRAND, CANVAS, new Map());

    expect(run?.finishedAt).toBeNull();
    expect(run?.template).toBeNull();
    expect(run?.report.lines[0]?.ruleId).toBe("R-GAP-000");
  });

  it("passes a metered call's own event through when there is one", async () => {
    const { client, calls } = fakeClient({ credit_spend_output: { data: { ok: true, charged: false, price: 0, balance: 5, entry_id: null } } });
    await spendFlowOutput(client, { brandId: BRAND, userId: BOARD, designVersionHash: "hash", outputKey: BOARD, usageEventId: ENTRY });

    expect((calls[0]?.steps[0]?.[1][0] as Record<string, unknown>)["p_usage_event_id"]).toBe(ENTRY);
  });
});

describe("a run while credits are not being enforced", () => {
  it("charges nothing, gives nothing back when a board fails, and says so", async () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const meter = stubMeter({ enforced: false });
    const report = await runFlow(
      { capability: stubCapability({ failing: ["line-up"] }), meter, recorder: stubRecorder() },
      graph,
      { from: null, scope: "all" },
      STUB_COSTS,
    );
    const failed = report.lines.find((line) => line.boardId === "line-up");

    expect(failed?.credits).toBe(0);
    expect(failed?.refunded).toBe(0);
    expect(meter.moves).toEqual([]);
    expect(summaryLine(runSummary(graph, report))).toContain("nothing was charged");
  });

  it("says how many did not finish even when none of them cost anything", async () => {
    const { graph } = canvasOfTemplate("shopify-product-listing");
    const report = await runFlow(
      { capability: stubCapability({ failing: ["white-square"] }), meter: stubMeter({ enforced: false }), recorder: stubRecorder() },
      graph,
      { from: null, scope: "all" },
      STUB_COSTS,
    );

    expect(summaryLine(runSummary(graph, report))).toBe("6 assets ready, nothing was charged, 1 did not finish.");
  });
});

describe("the odd values a card and a zip can hold", () => {
  it("shows a value that is only spaces as missing, rather than as a blank row", () => {
    const view = infoCard("feature_callouts", {
      sizes: [],
      measures: [],
      colours: [],
      fabrics: [],
      features: [
        { label: "Side seams", words: "   ", ruleId: "R-CON-001" },
        { label: "Cuffs", words: "Ribbed", ruleId: "R-CON-002" },
      ],
      care: [],
    });

    expect(view.missing).toBe(1);
    expect(view.sections[0]?.rows[0]?.cells[0]?.value).toBe("Not filled in yet");
  });

  it("lists a zip's files in the order they sit in it, labels and all", () => {
    const entries = [
      { boardId: "clip", name: "Walk-out", format: "mp4" as const, bytes: new Uint8Array([1]), label: "AI-generated" },
      { boardId: "render", name: "Front render", format: "png" as const, bytes: new Uint8Array([2]), label: null },
    ];
    const written = contentsText(entries, exportPaths(entries));

    expect(written.indexOf("png/front-render.png")).toBeLessThan(written.indexOf("mp4/walk-out.mp4"));
    expect(written).toContain("mp4/walk-out.mp4\tWalk-out\tAI-generated");
  });

  it("keeps a board that holds a picture out of nothing, when the run says it is ready", async () => {
    const { graph } = canvasOfTemplate("sponsor-pack");
    const report = await runFlow(
      { capability: stubCapability(), meter: stubMeter(), recorder: stubRecorder() },
      graph,
      { from: null, scope: "all" },
      STUB_COSTS,
    );
    const summary = runSummary(graph, report);

    expect(summary.rows.every((row) => row.fileId !== FILE)).toBe(true);
    expect(summary.byFormat.map((one) => one.format)).toEqual(["png", "pdf"]);
  });
});
