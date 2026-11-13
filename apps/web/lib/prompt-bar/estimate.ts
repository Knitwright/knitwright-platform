import { estimateFlow, flowCostSource, type FlowEstimate } from "@/lib/flows/cost";
import { LAUNCH_GAP_RULE, type BoardLink, type BoardView, type Graph, type LaunchCostSource } from "@/lib/launch";
import type { GenerationPlan, NewBoard } from "./plan";

/**
 * THE COST SHOWN BEFORE SEND (decision 0149; `08` §5.6 "Generate ⓒ n, with the cost shown on hover").
 *
 * The figure is the run engine's own estimate (`estimateFlow`, decision 0096), worked out over the
 * canvas as it will be once the plan's boards are added. `runFlowAction` works the same estimate out
 * again on the server over the saved boards and refuses a run that costs more than the figure the
 * person was shown, so this number is the most a press can ever spend.
 */

/** The id a planned board has in the "as it will be" canvas. Never sent anywhere. */
export const plannedId = (key: string): string => `planned:${key}`;

const asView = (board: NewBoard): BoardView => ({
  id: plannedId(board.key),
  kind: board.kind,
  name: board.name,
  at: board.at,
  size: board.size,
  settings: board.settings,
  inputVersion: null,
  outputFileId: null,
  outputRole: "asset",
  status: "empty",
  lastCostCredits: null,
  ruleId: LAUNCH_GAP_RULE,
});

/** The id a plan's feed points at: a planned board's key becomes its planned id; a real id stays. */
const feedId = (plan: readonly NewBoard[], from: string): string => (plan.some((one) => one.key === from) ? plannedId(from) : from);

/** The canvas once the plan has happened, for the estimate. */
export function plannedGraph(graph: Graph, plan: GenerationPlan): Graph {
  if (!plan.ok) return graph;
  if (plan.action === "edit") {
    return { ...graph, boards: graph.boards.map((one) => (one.id === plan.board.id ? { ...one, settings: plan.settings } : one)) };
  }
  const edges: BoardLink[] = plan.boards.flatMap((board) =>
    board.feeds.map((feed) => ({ id: `planned:${board.key}:${feed.inputIndex}`, fromBoardId: feedId(plan.boards, feed.from), toBoardId: plannedId(board.key), inputIndex: feed.inputIndex })),
  );
  return { boards: [...graph.boards, ...plan.boards.map(asView)], edges: [...graph.edges, ...edges] };
}

/** The estimate for a plan, or null when the plan is a refusal. */
export function estimatePlan(graph: Graph, plan: GenerationPlan, costs: LaunchCostSource): FlowEstimate | null {
  if (!plan.ok) return null;
  const from = plan.action === "edit" ? plan.board.id : plannedId(plan.runKey);
  const scope = plan.action === "edit" ? "board" : plan.scope;
  return estimateFlow(plannedGraph(graph, plan), { from, scope }, flowCostSource(costs));
}

/** The words on the send button's hover, and for a screen reader. */
export function sendLabel(estimate: FlowEstimate | null, mode: "image" | "video"): string {
  const what = mode === "video" ? "Generate video" : "Generate image";
  if (estimate === null) return what;
  if (estimate.blocked > 0 && estimate.credits === 0) return `${what} · cannot run yet`;
  return estimate.credits === 0 ? `${what} · free` : `${what} · ${estimate.credits} credit${estimate.credits === 1 ? "" : "s"}`;
}
