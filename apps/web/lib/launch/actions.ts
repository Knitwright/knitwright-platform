"use server";

import { revalidatePath } from "next/cache";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { GENERATED_LABEL, type LaunchAsset } from "./assets";
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
 * Records what a run produced (`offerAsset` of the contract). The asset is rebuilt here as a
 * `LaunchAsset` so `acceptAsset` judges it: a generated picture offered as a panel layer or a
 * print file is refused in this action, refused again by the service, and refused a third time by
 * the database's own constraint (spec decision 13). The board's kind comes from the canvas, never
 * from the body.
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
      asset: assetFrom(input.asset),
      status: input.status,
      credits: input.credits,
    });
    refresh(input.launchProjectId);
    return { boardId: board.id, status: input.status };
  },
});

/**
 * The body's asset as a `LaunchAsset`, exactly as the body gave it -- including a role a generated
 * picture may not have. The cast is deliberate: `acceptAsset` is the one thing that refuses such an
 * asset, and rewriting it here would hide the refusal instead of making it.
 */
function assetFrom(asset: RecordOutputBody["asset"]): LaunchAsset | null {
  if (asset === null) return null;
  const file = { fileId: asset.fileId, contentType: "application/octet-stream" };
  if (asset.provenance === "generated") {
    return { role: asset.role, provenance: "generated", file, label: GENERATED_LABEL, showsPerson: asset.showsPerson } as LaunchAsset;
  }
  return { role: asset.role, provenance: asset.provenance, file };
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
