import { isGeneratedKind, type BoardView } from "@/lib/launch";
import { FLOW_GAP_RULE } from "./types";

/**
 * Remix (the launch shell's task bar over a picture, decision 0133): the same board, the same prompt,
 * the same scene, a new attempt.
 *
 * It is a change to the board's own settings -- a `remix` count, which the AI scene's seed is made
 * from (`real/scene.ts`) -- followed by a rerun, so it is charged, refunded and recorded exactly like
 * any other run. Regenerate keeps the count and so the seed; Remix moves it on.
 *
 * Only a picture a model made can be remixed. On a picture the platform drew it would change the
 * garment, which no tool may change (spec decision 13); the task bar already offers it on a generated
 * picture only, and this refuses the rest again on the server.
 */

export type RemixPlan =
  | Readonly<{ ok: true; settings: Readonly<Record<string, unknown>>; remix: number }>
  | Readonly<{ ok: false; reason: string; ruleId: string }>;

export const REMIX_DRAWN_LINE = "This picture is the one the platform drew, so the garment in it cannot be changed.";

const countOf = (value: unknown): number => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0);

export function planRemix(board: BoardView): RemixPlan {
  if (!isGeneratedKind(board.kind)) return { ok: false, reason: REMIX_DRAWN_LINE, ruleId: FLOW_GAP_RULE };
  const remix = countOf(board.settings["remix"]) + 1;
  return { ok: true, settings: { ...board.settings, remix }, remix };
}
