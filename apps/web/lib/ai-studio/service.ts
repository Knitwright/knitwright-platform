import type { SupabaseClient } from "@supabase/supabase-js";
import { applyFlowTemplate } from "@/lib/flows/service";
import type { ArtboardPreset } from "@/lib/launch";
import { connectBoards, createLaunchProject, saveBoard } from "@/lib/launch/service";
import { placeBoards, type CanvasPlan, type PlannedBoard } from "./canvas-plan";

/**
 * Setting a launch canvas up from a workflow's plan (decision 0141). Every write goes through the
 * launch shell's own database functions -- the same ones a person's clicks on the canvas call -- so
 * each is checked for the brand, the role and the board table again in the database. Nothing here
 * runs a board: the canvas does that, with the cost shown first.
 */

type Who = Readonly<{ brandId: string; userId: string }>;

export interface CanvasStart {
  readonly name: string;
  readonly designProjectId: string;
  readonly designVersion: number;
  readonly plan: CanvasPlan;
  readonly presets: readonly ArtboardPreset[];
}

const designSettings = (start: CanvasStart): Readonly<Record<string, unknown>> => ({ designProjectId: start.designProjectId });

async function saveBoards(admin: SupabaseClient, who: Who, launchProjectId: string, start: CanvasStart, boards: readonly PlannedBoard[]): Promise<void> {
  const places = placeBoards(boards);
  const ids = new Map<string, string>();
  for (const [index, board] of boards.entries()) {
    const at = places[index] ?? { x: 0, y: 0 };
    const design = board.kind === "design";
    const id = await saveBoard(admin, who, {
      launchProjectId,
      boardId: null,
      kind: board.kind,
      name: board.name,
      x: at.x,
      y: at.y,
      width: board.size.width,
      height: board.size.height,
      settings: design ? designSettings(start) : board.settings,
      inputVersion: design ? start.designVersion : null,
    });
    ids.set(board.key, id);
  }
  for (const board of boards) {
    for (const [index, from] of board.feeds.entries()) {
      await connectBoards(admin, who, { launchProjectId, fromBoardId: ids.get(from) as string, toBoardId: ids.get(board.key) as string, inputIndex: index + 1 });
    }
  }
}

/** A new launch canvas for the design, laid out as the plan says. Its id. */
export async function startCanvas(admin: SupabaseClient, who: Who, start: CanvasStart): Promise<string> {
  const launchProjectId = await createLaunchProject(admin, who, { name: start.name, units: "px", designProjectId: start.designProjectId });
  if ("template" in start.plan) {
    await applyFlowTemplate(admin, who, {
      launchProjectId,
      template: start.plan.template,
      designProjectId: start.designProjectId,
      designVersion: start.designVersion,
      presets: start.presets,
    });
  } else {
    await saveBoards(admin, who, launchProjectId, start, start.plan.boards);
  }
  return launchProjectId;
}
