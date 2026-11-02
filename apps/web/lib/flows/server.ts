import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { designVersionHash } from "@/lib/credits/version-hash";
import { getEnv } from "@/lib/config/env";
import { recordOutput, type Who } from "@/lib/launch/service";
import { loadLaunchCanvas } from "@/lib/launch/server";
import type { Graph } from "@/lib/launch";
import { capabilityOf, EMPTY_REGISTRY, type FlowCapabilityRegistry } from "./capabilities";
import { estimateFlow, flowCostSource, type FlowEstimate } from "./cost";
import { finishFlowRun, latestFlowRun, refundFlowSpend, setFlowRunBoard, spendFlowOutput, startFlowRun } from "./service";
import { runFlow, type Charge, type FlowMeter, type FlowRecorder, type FlowRunReport } from "./run";
import { estimateSummary, runSummary, type FlowSummary } from "./summary";
import type { ScopeInput } from "./topology";
import { FLOW_GAP_RULE } from "./types";

/**
 * Joins the flow screens to the launch canvas, the credit ledger and the flow tables. It holds no
 * rules of its own -- `topology.ts`, `cost.ts`, `run.ts`, `artwork.ts` and `summary.ts` have those
 * and are tested on their own -- and the database tests and the end-to-end tests cover the joining.
 *
 * Two things are worth reading here rather than assuming.
 *
 * **The money.** A paid board is charged through the credit ledger before it runs and given its
 * credits back the moment it fails, through `credit_refund_spend`, which gives back one spend
 * rather than every spend on a design version. `CREDITS_ENFORCED` is off, so nothing is charged at
 * all today: the meter then reports `charged: false` and `credits: 0`, and the run says "nothing was
 * charged" instead of pretending. The behaviour is written for the day it is turned on.
 *
 * **The run.** No model is called: `capabilityOf` hands every board to a deterministic stub until
 * L2 to L5 register their adapters. The run still goes through every check -- the order, the
 * garment lock, the branch check on artwork, the estimate and the refund -- so when a real adapter
 * arrives nothing here changes.
 */

export interface FlowRunDeps {
  readonly admin: SupabaseClient;
  readonly who: Who;
  readonly registry?: FlowCapabilityRegistry;
}

/**
 * The meter: a charge per board, keyed by the design version and the board, so one board of a pack
 * failing gives back one charge and the rest stand. `credit_spend_output` is the migration's own
 * function for that shape (decision 0096).
 */
export function flowMeter(admin: SupabaseClient, who: Who): FlowMeter {
  const entries = new Map<string, string | null>();
  return {
    charge: async (input): Promise<Charge> => {
      const design = input.request.garment;
      if (design.designProjectId === null || design.version === null) {
        return { ok: false, reason: "This board has no design version behind it, so it cannot be charged for." };
      }
      const outcome = await spendFlowOutput(admin, {
        brandId: who.brandId,
        userId: who.userId,
        designVersionHash: designVersionHash(design.designProjectId, design.version),
        outputKey: input.boardId,
      });
      if (!outcome.ok) return { ok: false, reason: `This board costs ${outcome.price} credits and the balance is ${outcome.balance}.` };
      entries.set(input.boardId, outcome.entryId);
      return { ok: true, charged: outcome.charged, credits: outcome.charged ? outcome.price : 0, entryId: outcome.entryId };
    },
    refund: async (input): Promise<number> => {
      const entryId = input.entryId ?? entries.get(input.boardId) ?? null;
      if (entryId === null || input.credits === 0) return 0;
      return await refundFlowSpend(admin, who.brandId, entryId, "A flow board did not finish");
    },
  };
}

/** The recorder: L1's one door to a board's output, which asks `acceptAsset` before it writes. */
export const flowRecorder = (admin: SupabaseClient, who: Who): FlowRecorder => ({
  record: async (input) =>
    await recordOutput(admin, who, {
      boardId: input.boardId,
      kind: input.kind,
      asset: input.asset,
      status: input.status,
      credits: input.credits,
    }),
});

export interface FlowRunOutcome {
  readonly runId: string;
  readonly report: FlowRunReport;
  readonly summary: FlowSummary;
}

/**
 * Runs a flow and writes down everything it did: a row for the run, a row per board as it finishes,
 * and the totals. The estimate is worked out here as well, so the figure a person was shown is the
 * figure the run was started with.
 */
export async function runFlowForBrand(
  deps: FlowRunDeps,
  input: Readonly<{ launchProjectId: string; graph: Graph; scope: ScopeInput; template: string | null; costs: Parameters<typeof estimateFlow>[2] }>,
): Promise<FlowRunOutcome> {
  const estimate = estimateFlow(input.graph, input.scope, input.costs);
  const runId = await startFlowRun(deps.admin, deps.who, {
    launchProjectId: input.launchProjectId,
    scope: input.scope.scope,
    fromBoardId: input.scope.from,
    estimateCredits: estimate.credits,
    template: input.template,
  });
  let position = 0;
  const report = await runFlow(
    {
      capability: capabilityOf(deps.registry ?? EMPTY_REGISTRY),
      meter: flowMeter(deps.admin, deps.who),
      recorder: flowRecorder(deps.admin, deps.who),
      onProgress: () => undefined,
    },
    input.graph,
    input.scope,
    input.costs,
  );
  for (const line of report.lines) {
    position += 1;
    await setFlowRunBoard(deps.admin, deps.who, {
      runId,
      boardId: line.boardId,
      position,
      status: line.state,
      credits: line.credits,
      refunded: line.refunded,
      spendEntryId: null,
      assets: line.assets,
      format: line.format,
      outputFileId: line.fileId,
      reason: line.reason,
    });
  }
  await finishFlowRun(deps.admin, deps.who, {
    runId,
    status: report.state,
    spent: report.spent,
    refunded: report.refunded,
    assets: report.assets,
  });
  return { runId, report, summary: runSummary(input.graph, report) };
}

export interface FlowPanel {
  readonly estimate: FlowEstimate;
  readonly summary: FlowSummary;
  /** The run the panel is showing, or null when the canvas has never been run. */
  readonly runId: string | null;
  readonly note: string;
}

/**
 * What the `flow-run` panel shows when the page opens: the estimate for Run all, and the last run
 * if there was one, read back from the flow tables so a reload shows the same panel.
 */
export async function loadFlowPanel(client: SupabaseClient, brandId: string, launchProjectId: string): Promise<FlowPanel | null> {
  const canvas = await loadLaunchCanvas(client, brandId, launchProjectId);
  if (canvas === null) return null;
  const graph: Graph = { boards: canvas.project.boards, edges: canvas.project.edges };
  const costs = flowCostSource(canvas.costs);
  const estimate = estimateFlow(graph, { from: null, scope: "all" }, costs);
  const names = new Map(canvas.project.boards.map((board) => [board.id, { name: board.name, kind: board.kind }]));
  const run = await latestFlowRun(client, brandId, launchProjectId, names).catch(() => null);
  return {
    estimate,
    summary: run === null ? estimateSummary(estimate) : runSummary(graph, { ...run.report, estimate }),
    runId: run?.id ?? null,
    note: EMPTY_REGISTRY.note,
  };
}

/** True while no credit is actually taken, so the screens can say so plainly. */
export const creditsEnforced = (): boolean => getEnv().CREDITS_ENFORCED === true;

export const FLOW_RULE = FLOW_GAP_RULE;
