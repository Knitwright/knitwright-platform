import type { BoardKind, TaskAction, TaskBar } from "@/lib/launch";
import type { OperationId } from "./operations";

/**
 * WHAT EACH TASK-BAR BUTTON DOES (decision 0133).
 *
 * The launch shell used to answer Remove background, Remix and Generate video -- and Flatten,
 * Upscale and Download -- by selecting the board and nothing else, so a button that looked like an
 * action did nothing a person could see. A button now does its own thing or is not offered:
 *
 *   * **Remix** reruns the generated picture with a new attempt (`remix.ts`);
 *   * **Generate video** adds an AI video board fed by the picture, where the clip's model, length
 *     and cost are chosen and shown before anything is spent (F-L3: "Generate shows the cost first");
 *   * **Flatten** and **Upscale** run the operation (`operations.ts`), at Upscale's default factor;
 *   * **Reframe** needs a shape, so it opens the board's own panel, where the shapes are;
 *   * **Download** opens the board's file through the files route;
 *   * **Remove background is not offered.** No provider cuts a background out of a picture yet
 *     (`lib/panel-layers/background.ts` holds only a stand-in that refuses), and a button that
 *     can only refuse is a button that should not be there.
 */

export type TaskStep =
  | Readonly<{ do: "remix" }>
  | Readonly<{ do: "add"; kind: BoardKind }>
  | Readonly<{ do: "operation"; operation: OperationId }>
  | Readonly<{ do: "open-board" }>
  | Readonly<{ do: "download" }>
  | Readonly<{ do: "duplicate" }>
  | Readonly<{ do: "remove" }>;

/** The buttons no capability stands behind yet, which the shell leaves off the bar. */
export const UNOFFERED_TASK_ACTIONS: readonly TaskAction[] = ["remove-background"];

export const TASK_STEPS: Readonly<Record<TaskAction, TaskStep | null>> = {
  "remove-background": null,
  remix: { do: "remix" },
  "generate-video": { do: "add", kind: "ai_video" },
  flatten: { do: "operation", operation: "flatten" },
  upscale: { do: "operation", operation: "upscale" },
  reframe: { do: "open-board" },
  download: { do: "download" },
  duplicate: { do: "duplicate" },
  remove: { do: "remove" },
};

/** The bar as the shell draws it: every item that has a step behind it, and no other. */
export const offeredBar = (bar: TaskBar): TaskBar => ({
  ...bar,
  items: bar.items.filter((item) => !UNOFFERED_TASK_ACTIONS.includes(item.id) && TASK_STEPS[item.id] !== null),
});

/** Where a file a board holds is opened, through the one route files reach a browser by. */
export const boardFilePath = (fileId: string): string => `/api/files/${fileId}`;
