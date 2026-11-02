import type { ArtboardPreset, BoardLink, BoardStatus, BoardView, Graph } from "@/lib/launch";
import { planTemplate, type FlowPlan } from "../apply";
import { flowTemplate } from "../templates";
import { FLOW_GAP_RULE } from "../types";

/**
 * A flow template as a canvas, for the tests. The board ids are the template's own step keys, which
 * makes a failing test readable ("line-up" rather than a uuid) and costs nothing: L1's graph holds
 * ids as opaque strings.
 */

/** The six artboard rows the launch migration seeds, as a fixture. Not a source of truth. */
export const PRESETS: readonly ArtboardPreset[] = [
  { key: "social-post-4-5", label: "Social post 4:5", width: 1080, height: 1350, unit: "px", dpi: 72, ruleId: FLOW_GAP_RULE, note: "Placeholder size, not reviewed by anyone" },
  { key: "social-square-1-1", label: "Social square 1:1", width: 1080, height: 1080, unit: "px", dpi: 72, ruleId: FLOW_GAP_RULE, note: "Placeholder size, not reviewed by anyone" },
  { key: "story-9-16", label: "Story 9:16", width: 1080, height: 1920, unit: "px", dpi: 72, ruleId: FLOW_GAP_RULE, note: "Placeholder size, not reviewed by anyone" },
  { key: "hero-banner-16-9", label: "Hero banner 16:9", width: 1920, height: 1080, unit: "px", dpi: 72, ruleId: FLOW_GAP_RULE, note: "Placeholder size, not reviewed by anyone" },
  { key: "pin-2-3", label: "Pin 2:3", width: 1000, height: 1500, unit: "px", dpi: 72, ruleId: FLOW_GAP_RULE, note: "Placeholder size, not reviewed by anyone" },
  { key: "a4-print", label: "A4 print", width: 210, height: 297, unit: "mm", dpi: 300, ruleId: FLOW_GAP_RULE, note: "ISO 216 A4; the resolution is a placeholder, not reviewed by anyone" },
];

/** A board as the database would hand it back once a plan has been saved. */
export const boardOfPlan = (plan: FlowPlan, key: string, status: BoardStatus = "empty"): BoardView => {
  const found = plan.boards.find((one) => one.key === key);
  if (!found) throw new Error(`No step ${key} in ${plan.slug}`);
  return {
    id: found.key,
    kind: found.kind,
    name: found.name,
    at: found.at,
    size: found.size,
    settings: found.settings,
    inputVersion: found.inputVersion,
    outputFileId: null,
    outputRole: "asset",
    status,
    lastCostCredits: null,
    ruleId: FLOW_GAP_RULE,
  };
};

export const graphOfPlan = (plan: FlowPlan): Graph => ({
  boards: plan.boards.map((one) => boardOfPlan(plan, one.key)),
  edges: plan.links.map(
    (link): BoardLink => ({ id: `${link.from}->${link.to}`, fromBoardId: link.from, toBoardId: link.to, inputIndex: link.inputIndex }),
  ),
});

export interface CanvasInput {
  readonly designProjectId?: string | null;
  readonly designVersion?: number | null;
}

/** One of the six packs, laid out and read back as a canvas. */
export function canvasOfTemplate(slug: string, input: CanvasInput = {}): Readonly<{ plan: FlowPlan; graph: Graph }> {
  const spec = flowTemplate(slug);
  if (!spec) throw new Error(`No flow template ${slug}`);
  const plan = planTemplate(spec, {
    designProjectId: input.designProjectId ?? "11111111-1111-4111-8111-111111111111",
    designVersion: input.designVersion ?? 7,
    presets: PRESETS,
  });
  return { plan, graph: graphOfPlan(plan) };
}

/** The same canvas with one board changed, for a test that needs a board part-way through a run. */
export const withBoard = (graph: Graph, boardId: string, change: Partial<BoardView>): Graph => ({
  boards: graph.boards.map((one) => (one.id === boardId ? { ...one, ...change } : one)),
  edges: graph.edges,
});
