import type { BoardKind } from "@/lib/launch";

/**
 * Flows: a launch pack on one canvas (plan v5 wave 4 L6, spec F-L4, decision 0096).
 *
 * L1 built the canvas, the board table and the graph; this directory runs it. Nothing here keeps a
 * second graph model: a flow is L1's `boards` and `board_edges` read through L1's own `canConnect`,
 * `runnable` and `garmentSource`, with four things added on top:
 *
 *   1. the six flow templates of `docs/spec/07-template-library.md`, as rows;
 *   2. a run: a topological order, a cost estimate shown first, a status per board and a refund on
 *      every failure;
 *   3. the three board operations the spec's task bar names -- Flatten, Upscale and Reframe;
 *   4. what a finished run hands on: a run summary, a zip with a folder per format, and a listing
 *      payload the Store (wave 5, O2) collects. A flow never publishes anything itself.
 *
 * THE GARMENT IS ALWAYS LOCKED, AND A FLOW IS WHERE THAT IS EASIEST TO LOSE. A chain of boards is
 * the one place a generated picture could be passed hop by hop until something forgot where it came
 * from. It cannot: every hop records its output through L1's `recordOutput`, whose asset type gives
 * a generated picture no role but `"scene"`, and this directory carries a provenance forward rather
 * than letting a hop invent a new one. `garment-lock.test.ts` runs a four-hop flow and watches
 * every door shut.
 */

/** No rulebook entry covers flows yet, so every refusal, cost and field carries this (decision 0096). */
export const FLOW_GAP_RULE = "R-GAP-000";

/** How a board's picture is made. A model costs credits; the platform's own drawing is free. */
export const GENERATIONS = ["deterministic", "model"] as const;
export type Generation = (typeof GENERATIONS)[number];

/** The folders "Export all" puts a run's outputs in, one per format (spec F-L4). */
export const FLOW_FORMATS = ["png", "jpg", "mp4", "pdf"] as const;
export type FlowFormat = (typeof FLOW_FORMATS)[number];

export const CONTENT_TYPES: Readonly<Record<FlowFormat, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  mp4: "video/mp4",
  pdf: "application/pdf",
};

/** What a run was asked for: one board, everything it feeds, or the whole canvas. */
export const FLOW_SCOPES = ["board", "downstream", "all"] as const;
export type FlowScope = (typeof FLOW_SCOPES)[number];

/** What happened to one board in a run. `skipped` is a board whose own input never finished. */
export const FLOW_BOARD_STATES = ["queued", "running", "ready", "failed", "skipped"] as const;
export type FlowBoardState = (typeof FLOW_BOARD_STATES)[number];

/** What happened to a run. `part_done` is some boards ready and some not. */
export const FLOW_RUN_STATES = ["queued", "running", "done", "part_done", "failed"] as const;
export type FlowRunState = (typeof FLOW_RUN_STATES)[number];

/** One step of a flow template: the board it adds, its own settings, and the note beside it. */
export interface FlowStepSpec {
  /** Stable inside the template, so a link names a step rather than a position. */
  readonly key: string;
  /** The yellow section label this step sits under (spec F-L4: "1 PICK YOUR KIT"). */
  readonly section: string;
  readonly kind: BoardKind;
  readonly name: string;
  /**
   * The board's own prompt, scene, colourway, aspect and seconds. Saved on the board, so a rerun
   * needs nothing typed again -- the acceptance test the spec cares about most (F-L4).
   */
  readonly settings: Readonly<Record<string, unknown>>;
  /** The grey instruction note beside the step, or null (spec F-L4). */
  readonly note: string | null;
  readonly generation: Generation;
  /** How many finished assets this step's output counts as. A Design board counts none. */
  readonly assets: number;
  readonly format: FlowFormat;
  /** The steps that feed this one, in input order ("image 1", "image 2"). */
  readonly feeds: readonly string[];
  readonly ruleId: string;
}

/** The "Watch tutorial" card of a flow template (spec F-L4). */
export interface TutorialCard {
  readonly title: string;
  readonly body: string;
  /** The film, or null while none has been made. A card never pretends to have one. */
  readonly url: string | null;
  readonly note: string;
  readonly ruleId: string;
}

export interface FlowTemplateSpec {
  readonly slug: string;
  readonly title: string;
  /** One sentence on what the pack is for, for the template card. */
  readonly lead: string;
  /** The yellow section labels, in the order the canvas lays them out. */
  readonly sections: readonly string[];
  readonly steps: readonly FlowStepSpec[];
  /** The asset count `07` gives for this pack. A test holds the steps to it. */
  readonly assets: number;
  readonly tutorial: TutorialCard;
  /** Says where the pack's shape came from. Every seeded pack says nobody has reviewed it. */
  readonly note: string;
  readonly ruleId: string;
  readonly sort: number;
}
