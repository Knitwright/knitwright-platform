import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { deleteDesign } from "@/lib/deletion/service";
import { removeLaunchProject } from "@/lib/launch/service";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { ProjectKind } from "./items";

/**
 * The Projects page's changes (decision 0139). Each goes through the server's own client and a
 * database function that checks the person may change the brand's projects; the brand and the
 * person always come from the session. Deleting for good is the existing deletion of each kind,
 * so a design's files go the way they always have (lib/deletion), and only from the Trash.
 */

export type Who = Readonly<{ brandId: string; userId: string }>;
export type ItemRef = Readonly<{ kind: ProjectKind; id: string }>;

export const MESSAGES_FOR = {
  folderNameTaken: "There is already a folder with that name.",
  tooManyFolders: "This brand has as many folders as it may have. Remove one first.",
  ordered: "This design has been ordered, so it stays. An order needs its design.",
  notAllowed: "Your role can look at projects but not change them. Ask an admin.",
  notFound: "That project or folder does not exist.",
  notInTrash: "Move it to the Trash first. Only projects in the Trash can be deleted for good.",
} as const;

type DatabaseError = Readonly<{ code?: string; hint?: string | null; message: string }>;

/** What a project-page function raised, as a sentence the person may read. */
export const refusal = (error: DatabaseError): AppError => {
  if (error.hint === "folder_name_taken") return new AppError("conflict", MESSAGES_FOR.folderNameTaken);
  if (error.hint === "too_many_folders") return new AppError("conflict", MESSAGES_FOR.tooManyFolders);
  if (error.hint === "ordered") return new AppError("conflict", MESSAGES_FOR.ordered);
  switch (error.code) {
    case "42501":
      return new AppError("forbidden", MESSAGES_FOR.notAllowed);
    case "22023":
      return new AppError("invalid_input", error.message);
    case "P0002":
    case "22P02":
      return new AppError("not_found", MESSAGES_FOR.notFound);
    default:
      return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  }
};

const run = async (admin: SupabaseClient, name: string, args: Record<string, unknown>): Promise<unknown> => {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw refusal(error);
  return data;
};

const whoArgs = (who: Who) => ({ p_brand_id: who.brandId, p_user_id: who.userId });

export const createFolder = async (admin: SupabaseClient, who: Who, name: string): Promise<string> =>
  z.uuid().parse(await run(admin, "create_project_folder", { ...whoArgs(who), p_name: name }));

export const renameFolder = async (admin: SupabaseClient, who: Who, folderId: string, name: string): Promise<void> => {
  await run(admin, "rename_project_folder", { ...whoArgs(who), p_folder_id: folderId, p_name: name });
};

export const removeFolder = async (admin: SupabaseClient, who: Who, folderId: string): Promise<void> => {
  await run(admin, "remove_project_folder", { ...whoArgs(who), p_folder_id: folderId });
};

/** Moves an item into a folder, or out of its folder when `folderId` is null. */
export const placeItem = async (admin: SupabaseClient, who: Who, item: ItemRef, folderId: string | null): Promise<void> => {
  await run(admin, "place_project_item", { ...whoArgs(who), p_kind: item.kind, p_item_id: item.id, p_folder_id: folderId });
};

export const trashItem = async (admin: SupabaseClient, who: Who, item: ItemRef): Promise<void> => {
  await run(admin, "trash_project_item", { ...whoArgs(who), p_kind: item.kind, p_item_id: item.id });
};

export const restoreItem = async (admin: SupabaseClient, who: Who, item: ItemRef): Promise<void> => {
  await run(admin, "restore_project_item", { ...whoArgs(who), p_kind: item.kind, p_item_id: item.id });
};

/** Whether the item is in the brand's Trash, read as the member, so the database's rules apply. */
const inTrash = async (client: SupabaseClient, who: Who, item: ItemRef): Promise<boolean> => {
  const column = item.kind === "design" ? "project_id" : "launch_project_id";
  const { data, error } = await client.from("project_trash").select("id").eq("brand_id", who.brandId).eq(column, item.id).maybeSingle();
  if (error) throw refusal(error);
  return data !== null;
};

/** Deletes an item in the Trash for good, through the existing deletion of its kind. */
export const deleteForGood = async (admin: SupabaseClient, client: SupabaseClient, who: Who, item: ItemRef): Promise<void> => {
  if (!(await inTrash(client, who, item))) throw new AppError("conflict", MESSAGES_FOR.notInTrash);
  if (item.kind === "design") {
    await deleteDesign(admin, { brandId: who.brandId, userId: who.userId, projectId: item.id });
    return;
  }
  await removeLaunchProject(admin, who, item.id);
};
