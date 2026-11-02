import { inputsOf, isGeneratedKind, type Graph, type LaunchAsset, type OutputRole } from "@/lib/launch";
import { FLOW_GAP_RULE } from "./types";

/**
 * THE HOLE A FLOW COULD OPEN, AND THE PLUG (spec decision 13, principle 4).
 *
 * L1 shuts three doors on a generated picture becoming artwork: the asset type gives it no role but
 * `"scene"`, `acceptAsset` refuses it again at runtime, and the schema refuses the row. All three
 * ask the same question -- *is this board one a model draws?* -- and for a single board that is the
 * whole question.
 *
 * A flow is a chain, and a chain can ask it of the wrong board. A Marketing board is a board the
 * platform draws itself, so all three doors let its output be a print file. Feed that Marketing
 * board an AI Image board and the print file now holds pixels a model made. Nothing in L1 is wrong;
 * the question simply stops at one hop.
 *
 * So this file asks it of the whole branch. **A board with a generated board anywhere behind it may
 * not record its output as a layer on the garment or as part of a print file**, however many hops
 * away that board is. `garment-lock.test.ts` walks a four-hop chain and watches it refused, and the
 * flow migration puts the same rule on `public.boards` as a trigger, so a write that never goes
 * through this code is refused as well.
 *
 * It does not stop a Marketing board holding a generated picture: a post with an AI scene in it is
 * exactly what the spec asks for, and it carries the "AI-generated" label. It stops that post being
 * used as artwork on a garment or in a print file a factory prints.
 */

/**
 * Whether a model made this board's own picture: its kind says so, or the board's settings do. The
 * settings matter because a board a flow template made records how it is made, and a kind L1 counts
 * as deterministic could be marked as a model scene by a later workstream's data.
 */
const drawnByModel = (board: Readonly<{ kind: Graph["boards"][number]["kind"]; settings: Readonly<Record<string, unknown>> }>): boolean =>
  isGeneratedKind(board.kind) || board.settings["generation"] === "model";

/** Every board a model drew that this board's picture could contain, however many hops back. */
export function generatedUpstream(graph: Graph, boardId: string): readonly string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  const queue = [boardId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const board = graph.boards.find((one) => one.id === id);
    if (board && drawnByModel(board)) found.push(board.id);
    for (const edge of inputsOf(graph, id)) queue.push(edge.fromBoardId);
  }
  return found;
}

/** True when a board's picture could hold pixels a model made, its own or one of its inputs'. */
export const carriesGenerated = (graph: Graph, boardId: string): boolean => generatedUpstream(graph, boardId).length > 0;

export type ArtworkVerdict = Readonly<{ allowed: true }> | Readonly<{ allowed: false; reason: string; ruleId: string }>;

const ARTWORK_ROLES: readonly OutputRole[] = ["panel_layer", "print_file"];

/**
 * Whether this board's output may be recorded in this role. Scenery always may. Artwork may only
 * when nothing a model made can have reached the board.
 */
export function artworkVerdict(graph: Graph, boardId: string, role: OutputRole): ArtworkVerdict {
  if (!ARTWORK_ROLES.includes(role)) return { allowed: true };
  const generated = generatedUpstream(graph, boardId);
  if (generated.length === 0) return { allowed: true };
  const board = graph.boards.find((one) => one.id === generated[0]);
  const named = board ? (board.name || "an AI board") : "an AI board";
  return {
    allowed: false,
    reason: `This board's picture comes through ${named}, and nothing a model made becomes a layer on the garment or part of a print file. Use it as an asset instead.`,
    ruleId: FLOW_GAP_RULE,
  };
}

/**
 * The role a finished picture may take on this board. `acceptAsset` has already said what the asset
 * itself may be; this narrows it to what the branch behind the board allows, so a chain can never
 * end in artwork that a model touched.
 */
export function roleFor(graph: Graph, boardId: string, asset: LaunchAsset): OutputRole {
  const wanted: OutputRole = asset.role === "scene" ? "asset" : asset.role;
  return artworkVerdict(graph, boardId, wanted).allowed ? wanted : "asset";
}
