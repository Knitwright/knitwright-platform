import { z } from "zod";
import { confirmField } from "@/lib/deletion/schemas";
import { PROJECT_KINDS } from "./items";

/** What the Projects page's actions accept (decision 0139). The brand and the person come from the session. */

const kind = z.enum(PROJECT_KINDS, "A project is a design or a launch project.");
const id = z.uuid("That is not a project.");
const folderId = z.uuid("That is not a folder.");

export const FOLDER_NAME_MESSAGE = "Give the folder a name of 1 to 60 characters.";

const folderName = z.string(FOLDER_NAME_MESSAGE).trim().min(1, FOLDER_NAME_MESSAGE).max(60, FOLDER_NAME_MESSAGE);

export const itemBody = z.object({ kind, id });

export const createFolderBody = z.object({ name: folderName });

export const renameFolderBody = z.object({ folderId, name: folderName });

export const removeFolderBody = z.object({ folderId });

/** An empty folder moves the item out of its folder. */
export const placeItemBody = z.object({
  kind,
  id,
  folderId: z.union([folderId, z.literal("").transform(() => null), z.null()]),
});

export const deleteForGoodBody = z.object({ kind, id, confirm: confirmField });
