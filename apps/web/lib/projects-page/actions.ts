"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { FOLDERS_PATH, PATHS_TO_REFRESH, TRASH_PATH, folderPath } from "./paths";
import { createFolderBody, deleteForGoodBody, itemBody, placeItemBody, removeFolderBody, renameFolderBody } from "./schemas";
import { createFolder, deleteForGood, placeItem, removeFolder, renameFolder, restoreItem, trashItem } from "./service";

/**
 * The Projects page's actions (decision 0139). The role is checked here for a clear answer and
 * again inside every database function; the brand and the person come from the session.
 */

const refresh = (): void => {
  for (const path of PATHS_TO_REFRESH) revalidatePath(path);
};

/** Makes a folder and opens it. */
export const createFolderAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.projectsPage,
  schema: createFolderBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const id = await createFolder(adminClient(), whoOf(session), input.name);
    refresh();
    redirect(folderPath(id));
  },
});

export const renameFolderAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.projectsPage,
  schema: renameFolderBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await renameFolder(adminClient(), whoOf(session), input.folderId, input.name);
    refresh();
    revalidatePath(folderPath(input.folderId));
    return { ok: true };
  },
});

/** Removes a folder; the projects in it stay, in no folder. Ends on the list of folders. */
export const removeFolderAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.projectsPage,
  schema: removeFolderBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await removeFolder(adminClient(), whoOf(session), input.folderId);
    refresh();
    redirect(FOLDERS_PATH as Route);
  },
});

export const placeItemAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.projectsPage,
  schema: placeItemBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await placeItem(adminClient(), whoOf(session), input, input.folderId);
    refresh();
    return { ok: true };
  },
});

export const trashItemAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.projectsPage,
  schema: itemBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await trashItem(adminClient(), whoOf(session), input);
    refresh();
    return { ok: true };
  },
});

export const restoreItemAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.projectsPage,
  schema: itemBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await restoreItem(adminClient(), whoOf(session), input);
    refresh();
    return { ok: true };
  },
});

/** Deletes a project in the Trash for good, with the typed word. Ends on the Trash. */
export const deleteForGoodAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.deleteDesign,
  schema: deleteForGoodBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await deleteForGood(adminClient(), await sessionClient(), whoOf(session), input);
    refresh();
    redirect(TRASH_PATH as Route);
  },
});
