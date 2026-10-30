"use client";

import {
  applySuggestionAction,
  inspirationBoardAction,
  removeMoodboardItemAction,
  saveToMoodboardAction,
  steerTagAction,
  suggestFromCardAction,
} from "@/lib/inspiration/actions";
import { BoardPanel, type BoardActions } from "./BoardPanel";

/**
 * `<InspirationPanel projectId=… />`: the inspiration side panel, wired to its actions (spec F-S1, decision 0082).
 * This is what the editor's Library panel mounts in its Inspiration slot; `BoardPanel` is the same panel with the
 * actions as arguments, which is how it is tested.
 */
const actions: BoardActions = {
  load: inspirationBoardAction,
  steer: steerTagAction,
  suggest: suggestFromCardAction,
  apply: applySuggestionAction,
  save: saveToMoodboardAction,
  remove: removeMoodboardItemAction,
};

export function InspirationPanel({ projectId, productLinks }: Readonly<{ projectId: string; productLinks?: readonly string[] }>) {
  return <BoardPanel projectId={projectId} actions={actions} {...(productLinks ? { productLinks } : {})} />;
}
