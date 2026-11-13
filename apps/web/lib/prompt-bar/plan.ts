import { boxOf, newBoardSize, type Point, type Size } from "@/lib/canvas";
import { BOARDS, isGarmentKind, type BoardKind, type BoardView, type Graph } from "@/lib/launch";
import { readBoardSettings as readVideo, writeBoardSettings as writeVideo } from "@/lib/media/video/ai-board";
import { readBoardSettings as readShoot, writeBoardSettings as writeShoot } from "@/lib/shoots/board";
import { MAX_PROMPT_WORDS, type PromptChoices } from "./modes";

/**
 * WHAT A PRESS OF SEND DOES TO THE CANVAS (plan v6 E5, decision 0149; `08` §5.6 and v3.2 "Prompt bar,
 * open").
 *
 * The prompt bar never makes a picture of its own. It writes the same board settings the AI image
 * and AI video panels write (`lib/shoots/board.ts`, `lib/media/video/ai-board.ts`) and asks the run
 * engine to run that board (`runFlowAction`, decision 0133), which charges, refunds and checks the
 * garment lock exactly as a Run button does. So this file only decides *which* board:
 *
 *   * the selected board is an AI board of the mode's kind -> that board is edited and run again
 *     ("Edit AI Image board");
 *   * otherwise a new board is added after the reference -- the selected board when the new kind
 *     accepts it, else the canvas's first garment board -- connected to it, and run;
 *   * a video needs a picture to move. From a garment board a free deterministic mockup is added
 *     first as the first frame (the AI Studio's video generator does the same, `canvas-plan.ts`).
 *
 * A canvas with no garment refuses in words: AI never draws the garment, so there is nothing to
 * put in the scene.
 */

export interface NewBoard {
  /** A key for this plan only; the real id comes back from the save. */
  readonly key: string;
  readonly kind: BoardKind;
  readonly name: string;
  readonly at: Point;
  readonly size: Size;
  readonly settings: Readonly<Record<string, unknown>>;
  /** What feeds it: a board already on the canvas (by id) or one of this plan's (by key). */
  readonly feeds: readonly Readonly<{ from: string; inputIndex: number }>[];
}

export type GenerationPlan =
  | Readonly<{ ok: false; reason: string }>
  | Readonly<{ ok: true; action: "edit"; board: BoardView; settings: Readonly<Record<string, unknown>> }>
  | Readonly<{ ok: true; action: "add"; boards: readonly NewBoard[]; runKey: string; scope: "board" | "downstream" }>;

export const NO_GARMENT =
  "Add a garment board first. AI never draws the garment: it makes a scene around the picture the platform drew of yours.";
export const NO_WORDS = "Describe what you want first.";
export const NEEDS_END_FRAME = "Frames to Video needs two boards: select the first frame, then Shift-click a mockup or AI image for the end frame.";

/** The gap the canvas leaves between a board and the one added after it (`ProjectCanvas` onAdd). */
export const ADD_GAP = 112;

/** An output size for a shape, 1080 on the short side: what the AI boards export at. */
export function sizeForAspect(aspect: string): Size {
  const [w, h] = aspect.split(":").map(Number);
  if (w === undefined || h === undefined || !(w > 0) || !(h > 0)) return { width: 1080, height: 1080 };
  return w >= h ? { width: Math.round((1080 * w) / h), height: 1080 } : { width: 1080, height: Math.round((1080 * h) / w) };
}

const targetKind = (choices: PromptChoices): BoardKind => (choices.mode === "video" ? "ai_video" : "ai_image");

const words = (choices: PromptChoices): string => choices.prompt.trim().slice(0, MAX_PROMPT_WORDS);

/** The board settings the mode writes, on top of whatever the board already holds. */
export function settingsFor(choices: PromptChoices, existing: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
  if (choices.mode === "video") {
    const now = readVideo(existing);
    return writeVideo({ ...now, prompt: words(choices), aspect: choices.videoAspect, seconds: choices.seconds, modelKey: choices.videoModelKey ?? now.modelKey });
  }
  const now = readShoot(existing);
  return writeShoot({ ...now, prompt: words(choices), style: choices.style, aspect: choices.imageAspect, count: choices.count });
}

const byId = (graph: Graph, id: string | undefined): BoardView | null => (id === undefined ? null : graph.boards.find((one) => one.id === id) ?? null);

const accepts = (kind: BoardKind, board: BoardView | null): board is BoardView => board !== null && BOARDS[kind].accepts.includes(board.kind);

const firstGarment = (graph: Graph): BoardView | null => graph.boards.find((one) => isGarmentKind(one.kind)) ?? null;

/** The place right of a board, as the connector's Add… puts a new board. */
export const placeAfter = (board: BoardView, rowOffset = 0): Point => {
  const box = boxOf(board);
  return { x: box.x + box.width + ADD_GAP, y: box.y + rowOffset };
};

const boardSize = (kind: BoardKind, aspect: string): Size => newBoardSize(kind) ?? sizeForAspect(aspect === "match" ? "1:1" : aspect);

function imagePlan(graph: Graph, selection: readonly string[], choices: PromptChoices): GenerationPlan {
  const picked = byId(graph, selection[0]);
  const reference = accepts("ai_image", picked) ? picked : firstGarment(graph);
  if (reference === null) return { ok: false, reason: NO_GARMENT };
  const board: NewBoard = {
    key: "image",
    kind: "ai_image",
    name: "",
    at: placeAfter(reference),
    size: boardSize("ai_image", choices.imageAspect),
    settings: settingsFor(choices),
    feeds: [{ from: reference.id, inputIndex: 1 }],
  };
  return { ok: true, action: "add", boards: [board], runKey: board.key, scope: "board" };
}

function videoPlan(graph: Graph, selection: readonly string[], choices: PromptChoices): GenerationPlan {
  const picked = byId(graph, selection[0]);
  const size = boardSize("ai_video", choices.videoAspect);
  const clip = (at: Point, feeds: NewBoard["feeds"]): NewBoard => ({ key: "clip", kind: "ai_video", name: "", at, size, settings: settingsFor(choices), feeds });
  if (choices.referenceMode === "frames") {
    const end = byId(graph, selection[1]);
    if (!accepts("ai_video", picked) || !accepts("ai_video", end)) return { ok: false, reason: NEEDS_END_FRAME };
    const board = clip(placeAfter(picked), [
      { from: picked.id, inputIndex: 1 },
      { from: end.id, inputIndex: 2 },
    ]);
    return { ok: true, action: "add", boards: [board], runKey: board.key, scope: "board" };
  }
  if (accepts("ai_video", picked)) {
    const board = clip(placeAfter(picked), [{ from: picked.id, inputIndex: 1 }]);
    return { ok: true, action: "add", boards: [board], runKey: board.key, scope: "board" };
  }
  const garment = picked !== null && isGarmentKind(picked.kind) ? picked : firstGarment(graph);
  if (garment === null) return { ok: false, reason: NO_GARMENT };
  const frameAt = placeAfter(garment);
  const frame: NewBoard = {
    key: "frame",
    kind: "mockup",
    name: "First frame",
    at: frameAt,
    size: boardSize("mockup", "1:1"),
    settings: { scene: "render-front" },
    feeds: [{ from: garment.id, inputIndex: 1 }],
  };
  const board = clip({ x: frameAt.x + boxOf({ ...garment, kind: "mockup", at: frameAt }).width + ADD_GAP, y: frameAt.y }, [{ from: "frame", inputIndex: 1 }]);
  return { ok: true, action: "add", boards: [frame, board], runKey: frame.key, scope: "downstream" };
}

/** What Send does, or why it cannot. Ask and Agentic never reach here: they make no board. */
export function planGeneration(graph: Graph, selection: readonly string[], choices: PromptChoices): GenerationPlan {
  if (words(choices) === "") return { ok: false, reason: NO_WORDS };
  const picked = byId(graph, selection[0]);
  if (picked !== null && picked.kind === targetKind(choices)) {
    return { ok: true, action: "edit", board: picked, settings: settingsFor(choices, picked.settings) };
  }
  return choices.mode === "video" ? videoPlan(graph, selection, choices) : imagePlan(graph, selection, choices);
}

/** The board the bar is editing, for the "Edit AI Image board ×" header, or null. */
export function editedBoard(graph: Graph, selection: readonly string[], mode: PromptChoices["mode"]): BoardView | null {
  const picked = byId(graph, selection[0]);
  if (picked === null) return null;
  if (mode === "image" && picked.kind === "ai_image") return picked;
  if (mode === "video" && picked.kind === "ai_video") return picked;
  return null;
}

/** The reference the strip shows: what a new board would be fed from, or null. */
export function referenceOf(graph: Graph, selection: readonly string[], mode: PromptChoices["mode"]): BoardView | null {
  const picked = byId(graph, selection[0]);
  const kind: BoardKind = mode === "video" ? "ai_video" : "ai_image";
  if (picked !== null && picked.kind === kind) {
    const edge = graph.edges.find((one) => one.toBoardId === picked.id && one.inputIndex === 1);
    return byId(graph, edge?.fromBoardId);
  }
  if (accepts(kind, picked)) return picked;
  if (picked !== null && isGarmentKind(picked.kind)) return picked;
  return firstGarment(graph);
}
