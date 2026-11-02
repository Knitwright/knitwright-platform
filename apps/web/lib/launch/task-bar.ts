import { BOARDS, isGeneratedKind, kindsAddableAfter, type BoardKind } from "./boards";
import type { BoardSelection } from "./panels";

/**
 * The contextual task bar over the selection (spec Launch shell, "Contextual task bar"):
 *
 *   * with a picture selected: Remove background · Remix · Generate video · more · duplicate ·
 *     download · ⋯
 *   * with a board selected: the boards it can feed · more (Flatten, Upscale, Reframe) · duplicate ·
 *     download · ⋯
 *
 * Two things are missing on purpose, and both are the garment lock rather than an omission:
 *
 *   * **Remove background and Remix are offered on a generated picture only.** They change the
 *     scene. On a picture the platform drew they would change the garment, and the garment is not
 *     a thing a tool may change (spec decision 13).
 *   * **Download is offered on a board with a finished output only**, so nothing is offered that
 *     would hand over an empty file.
 */

export const TASK_ACTIONS = [
  "remove-background",
  "remix",
  "generate-video",
  "flatten",
  "upscale",
  "reframe",
  "duplicate",
  "download",
  "remove",
] as const;

export type TaskAction = (typeof TASK_ACTIONS)[number];

export interface TaskItem {
  readonly id: TaskAction;
  readonly label: string;
  /** True for an item under "more", which the spec groups behind a chevron. */
  readonly inMore: boolean;
  /** Why the item is off, or null when it can be used. Shown as the disabled button's title. */
  readonly disabledReason: string | null;
}

/** An "Add…" entry: a board the selection may feed, drawn from the board table (spec F-L4). */
export interface AddItem {
  readonly kind: BoardKind;
  readonly label: string;
  readonly paid: boolean;
}

export interface TaskBar {
  readonly title: string;
  readonly add: readonly AddItem[];
  readonly items: readonly TaskItem[];
}

const LABELS: Readonly<Record<TaskAction, string>> = {
  "remove-background": "Remove background",
  remix: "Remix",
  "generate-video": "Generate video",
  flatten: "Flatten",
  upscale: "Upscale",
  reframe: "Reframe",
  duplicate: "Duplicate",
  download: "Download",
  remove: "Delete",
};

const item = (id: TaskAction, inMore: boolean, disabledReason: string | null = null): TaskItem => ({
  id,
  label: LABELS[id],
  inMore,
  disabledReason,
});

const SCENE_ONLY = "This picture is the one the platform drew, so the garment in it cannot be changed.";
const NOTHING_YET = "Run this board first: there is nothing to hand over yet.";

/** The bar for one selection, or null when nothing is selected. */
export function taskBar(selection: BoardSelection | null): TaskBar | null {
  if (!selection) return null;
  const { board, image } = selection;
  const info = BOARDS[board.kind];
  const ready = board.status === "ready" && board.outputFileId !== null;
  const generated = isGeneratedKind(board.kind);
  const add = kindsAddableAfter(board.kind).map((kind) => ({ kind, label: BOARDS[kind].label, paid: BOARDS[kind].paid }));

  if (image) {
    return {
      title: `${info.label} picture`,
      add: add.filter((entry) => entry.kind === "ai_video" || entry.kind === "marketing"),
      items: [
        item("remove-background", false, generated ? null : SCENE_ONLY),
        item("remix", false, generated ? null : SCENE_ONLY),
        item("generate-video", false, ready ? null : NOTHING_YET),
        item("upscale", true, ready ? null : NOTHING_YET),
        item("reframe", true, ready ? null : NOTHING_YET),
        item("duplicate", false),
        item("download", false, ready ? null : NOTHING_YET),
        item("remove", true),
      ],
    };
  }

  return {
    title: `${info.label} board`,
    add,
    items: [
      item("flatten", true, ready ? null : NOTHING_YET),
      item("upscale", true, ready ? null : NOTHING_YET),
      item("reframe", true, ready ? null : NOTHING_YET),
      item("duplicate", false),
      item("download", false, ready ? null : NOTHING_YET),
      item("remove", true),
    ],
  };
}
