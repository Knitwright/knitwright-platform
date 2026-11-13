import { artboardUnit, type ArtboardUnit } from "./artboard";
import { BOARDS, isGarmentKind, LAUNCH_GAP_RULE } from "./boards";
import { readAddress, type Query } from "./address";
import type { DockTool } from "./dock";
import { garmentSource, type Graph } from "./graph";
import { PANEL_OF_KIND, type BoardSelection, type LaunchPanelId } from "./panels";
import type { RailId } from "./rail";
import { taskBar, type TaskBar } from "./task-bar";
import type { LaunchProjectView } from "./types";

/**
 * Everything the launch project's page works out before it draws: which rail panel the address
 * asks for, which board is selected, which inspector that opens, which contextual task bar goes
 * over it, the unit, the zoom and the dock tool. Pure, so the page itself only reads the database
 * and hands this over -- the same shape as `lib/editor/page-state.ts`.
 */

/** A real empty state: what the screen is, and the one action that fills it. */
export interface EmptyState {
  readonly title: string;
  readonly body: string;
  /** The words on the one button. Never two choices: one action, named. */
  readonly action: string;
  readonly ruleId: string;
}

export interface LaunchPageState {
  readonly rail: RailId;
  readonly selection: BoardSelection | null;
  /** The panel the right inspector shows for the selection, or null to show the project's own. */
  readonly inspector: LaunchPanelId | null;
  readonly taskBar: TaskBar | null;
  readonly tool: DockTool;
  readonly unit: ArtboardUnit;
  readonly zoom: number;
  /** Why the selected board cannot be run, or null. Shown on the board and in the run summary. */
  readonly lockNote: string | null;
  readonly empty: EmptyState | null;
}

const EMPTY_CANVAS: EmptyState = {
  title: "Nothing on this canvas yet",
  body: "A launch project starts from one of your designs. Add a Design board and every mockup, picture, clip and post comes from it, so the garment is always the one the platform drew.",
  action: "Add a Design board",
  ruleId: LAUNCH_GAP_RULE,
};

const NO_DESIGN: EmptyState = {
  title: "No design on the canvas",
  body: "Every board starts from a Design board, because the garment in every picture is the one the platform drew for a design version. Add one and the Add… menu opens on each of its connectors.",
  action: "Add a Design board",
  ruleId: LAUNCH_GAP_RULE,
};

export interface LaunchPageInput {
  readonly query: Query;
  readonly project: LaunchProjectView;
}

/** The empty state of the canvas, or null when there is something to draw and a design behind it. */
export function emptyStateOf(graph: Graph): EmptyState | null {
  if (graph.boards.length === 0) return EMPTY_CANVAS;
  if (!graph.boards.some((board) => isGarmentKind(board.kind))) return NO_DESIGN;
  return null;
}

export function launchPageState({ query, project }: LaunchPageInput): LaunchPageState {
  const asked = readAddress(query);
  const graph: Graph = { boards: project.boards, edges: project.edges };
  const board = project.boards.find((one) => one.id === asked.boardId) ?? null;
  const selection: BoardSelection | null = board ? { board, image: asked.image } : null;
  const source = board && BOARDS[board.kind].maxInputs > 0 ? garmentSource(graph, board.id) : null;
  return {
    rail: asked.rail,
    selection,
    inspector: board ? PANEL_OF_KIND[board.kind] : null,
    taskBar: taskBar(selection),
    tool: asked.tool,
    unit: asked.unit ?? artboardUnit(project.units),
    zoom: asked.zoom,
    lockNote: source && !source.locked ? source.reason : null,
    empty: emptyStateOf(graph),
  };
}
