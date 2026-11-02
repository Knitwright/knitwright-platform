"use server";

import { revalidatePath } from "next/cache";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import type { AssetOffer } from "./assets";
import { canConnect, nextInput } from "./graph";
import { LAUNCH_HOME, launchProjectPath } from "./menu";
import {
  connectBoardsBody,
  createLaunchProjectBody,
  disconnectBoardsBody,
  recordOutputBody,
  removeBoardBody,
  removeLaunchProjectBody,
  saveBoardBody,
  saveLaunchProjectBody,
  saveVersionBody,
  type RecordOutputBody,
} from "./schemas";
import {
  connectBoards,
  createLaunchProject,
  disconnectBoards,
  loadLaunchProject,
  recordOutput,
  removeBoard,
  removeLaunchProject,
  saveBoard,
  saveLaunchProject,
  saveLaunchVersion,
  snapshotOf,
} from "./service";

/**
 * The launch shell's actions (plan v5 L1, decision 0091). The brand and the person come from the
 * session; the role is checked here for a clear answer and again inside every database function.
 *
 * `connectLaunchBoardsAction` asks `canConnect` before the database does, so a panel gets the
 * sentence a person can read rather than a constraint name. The database refuses the same wiring
 * either way, which is what makes the rule a rule and not a reminder.
 *
 * Nothing here runs a board. A run is a paid call, and it belongs to the workstream that owns the
 * capability (L2 to L6, through the files-service contract or the lifestyle adapters). The shell
 * states the cost, checks the garment lock and records the result.
 */

const refresh = (launchProjectId: string): void => {
  revalidatePath(LAUNCH_HOME);
  revalidatePath(launchProjectPath(launchProjectId));
};

export const createLaunchProjectAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: createLaunchProjectBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const id = await createLaunchProject(adminClient(), whoOf(session), input);
    revalidatePath(LAUNCH_HOME);
    return { id };
  },
});

export const saveLaunchProjectAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: saveLaunchProjectBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const id = await saveLaunchProject(adminClient(), whoOf(session), input);
    refresh(input.launchProjectId);
    return { id };
  },
});

export const removeLaunchProjectAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: removeLaunchProjectBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await removeLaunchProject(adminClient(), whoOf(session), input.launchProjectId);
    revalidatePath(LAUNCH_HOME);
    return { removed: input.launchProjectId };
  },
});

export const saveBoardAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: saveBoardBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const id = await saveBoard(adminClient(), whoOf(session), input);
    refresh(input.launchProjectId);
    return { id };
  },
});

export const removeBoardAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: removeBoardBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await removeBoard(adminClient(), whoOf(session), input.boardId);
    refresh(input.launchProjectId);
    return { removed: input.boardId };
  },
});

/**
 * Draws a connector. The wiring is checked against the board table here, with the canvas in hand,
 * so an input number nobody chose is the next free one rather than a clash.
 */
export const connectLaunchBoardsAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: connectBoardsBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const project = await loadLaunchProject(await sessionClient(), session.brand.id, input.launchProjectId);
    if (project === null) throw new AppError("not_found", "That launch project does not exist.");
    const graph = { boards: project.boards, edges: project.edges };
    const index = input.inputIndex === 1 ? nextInput(graph, input.toBoardId) ?? 1 : input.inputIndex;
    const verdict = canConnect(graph, input.fromBoardId, input.toBoardId, index);
    if (!verdict.allowed) throw new AppError("conflict", verdict.reason);
    const id = await connectBoards(adminClient(), whoOf(session), { ...input, inputIndex: index });
    refresh(input.launchProjectId);
    return { id, inputIndex: index };
  },
});

export const disconnectLaunchBoardsAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: disconnectBoardsBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await disconnectBoards(adminClient(), whoOf(session), input.edgeId);
    refresh(input.launchProjectId);
    return { removed: input.edgeId };
  },
});

/**
 * Records what a run produced (`offerAsset` of the contract).
 *
 * The body says which file and what the panel wants it used as. **What made the file is not in the
 * body and cannot be**: `recordOutput` reads it from `public.files.provenance` and judges the ask
 * against that, the database judges it again in `set_launch_board_output`, and
 * `boards_generated_output_is_never_artwork` refuses the row a third time (spec decision 13;
 * security review v5 H1, decision 0116). The board's kind comes from the canvas, never from the
 * body.
 */
export const recordBoardOutputAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: recordOutputBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const project = await loadLaunchProject(await sessionClient(), session.brand.id, input.launchProjectId);
    const board = project?.boards.find((one) => one.id === input.boardId);
    if (!board) throw new AppError("not_found", "That board does not exist.");
    await recordOutput(adminClient(), whoOf(session), {
      boardId: board.id,
      kind: board.kind,
      offer: offerFrom(input.asset),
      status: input.status,
      credits: input.credits,
    });
    refresh(input.launchProjectId);
    return { boardId: board.id, status: input.status };
  },
});

/**
 * The body as an offer. There is no cast here any more, and nothing for one to hide.
 *
 * The old version of this function rebuilt the body's asset verbatim and asserted `as LaunchAsset`
 * on purpose, with a comment saying the cast was safe because "`acceptAsset` is the one thing that
 * refuses such an asset". That was the false premise the v5 security review's H1 turned on:
 * `acceptAsset` only entered its refusal branch when the body *admitted* `"generated"`, so a body
 * that said `"deterministic"` about a file a model had made fell straight through. An offer carries
 * no provenance at all, so there is nothing left to assert.
 */
function offerFrom(asset: RecordOutputBody["asset"]): AssetOffer | null {
  if (asset === null) return null;
  return {
    role: asset.role,
    file: { fileId: asset.fileId, contentType: "application/octet-stream" },
    showsPerson: asset.showsPerson,
  };
}

/** The main menu's Save: the canvas as it stands, kept for the Version history. */
export const saveLaunchVersionAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: saveVersionBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const project = await loadLaunchProject(await sessionClient(), session.brand.id, input.launchProjectId);
    if (project === null) throw new AppError("not_found", "That launch project does not exist.");
    const version = await saveLaunchVersion(adminClient(), whoOf(session), input.launchProjectId, snapshotOf(project, new Date()));
    refresh(input.launchProjectId);
    return { version };
  },
});
