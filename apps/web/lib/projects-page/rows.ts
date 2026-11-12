import { z } from "zod";
import { getType } from "@/lib/garment";
import type { ProjectItem } from "./items";

/**
 * The rows the Projects page reads, and how each becomes a card (decision 0139). Kept apart from
 * the reads so the mapping is tested without a database.
 */

export const designRow = z.object({
  id: z.uuid(),
  name: z.string(),
  garment_type: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const launchRow = z.object({
  id: z.uuid(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  boards: z.array(z.object({ id: z.uuid() })),
});

export const placementRow = z.object({
  folder_id: z.uuid(),
  project_id: z.uuid().nullable(),
  launch_project_id: z.uuid().nullable(),
});

export const trashRow = z.object({
  project_id: z.uuid().nullable(),
  launch_project_id: z.uuid().nullable(),
  trashed_at: z.string(),
});

/** A ready shoot of AI Creations (creations.ts). */
export const shootRow = z.object({
  id: z.uuid(),
  launch_project_id: z.uuid(),
  aspect: z.string(),
  output_file_id: z.uuid(),
  finished_at: z.string(),
});

/** A lifestyle picture of AI Creations, with the design its media set belongs to. */
export const lifestyleRow = z.object({
  id: z.uuid(),
  file_id: z.uuid(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  created_at: z.string(),
  media_sets: z.object({ project_id: z.uuid() }),
});

export const folderRow =z.object({ id: z.uuid(), name: z.string(), created_at: z.string() });

export const sharedRow = z.object({
  invite_id: z.uuid(),
  brand_name: z.string(),
  project_name: z.string(),
  access: z.enum(["view", "comment", "edit"]),
  invited_at: z.string(),
  expires_at: z.string(),
  opened_at: z.string().nullable(),
});

export type DesignRow = z.output<typeof designRow>;
export type LaunchRow = z.output<typeof launchRow>;
export type PlacementRow = z.output<typeof placementRow>;
export type TrashRow = z.output<typeof trashRow>;

export interface SharedItem {
  readonly inviteId: string;
  readonly brandName: string;
  readonly projectName: string;
  readonly access: "view" | "comment" | "edit";
  readonly invitedAt: string;
  readonly expiresAt: string;
  readonly opened: boolean;
}

export const ACCESS_LABELS: Readonly<Record<SharedItem["access"], string>> = {
  view: "Can view",
  comment: "Can comment",
  edit: "Can edit",
};

export const sharedOf = (row: z.output<typeof sharedRow>): SharedItem => ({
  inviteId: row.invite_id,
  brandName: row.brand_name,
  projectName: row.project_name,
  access: row.access,
  invitedAt: row.invited_at,
  expiresAt: row.expires_at,
  opened: row.opened_at !== null,
});

type Marks = Readonly<{ folders: ReadonlyMap<string, string>; trash: ReadonlyMap<string, string> }>;

/** Which folder each item is in and when each trashed item was trashed, keyed by `kind:id`. */
export const marksOf = (placements: readonly PlacementRow[], trash: readonly TrashRow[]): Marks => {
  const key = (row: { project_id: string | null; launch_project_id: string | null }): string =>
    row.project_id !== null ? `design:${row.project_id}` : `launch:${row.launch_project_id}`;
  return {
    folders: new Map(placements.map((row) => [key(row), row.folder_id])),
    trash: new Map(trash.map((row) => [key(row), row.trashed_at])),
  };
};

export const designItem = (row: DesignRow, marks: Marks): ProjectItem => ({
  kind: "design",
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  artboards: null,
  detail: getType(row.garment_type)?.label ?? row.garment_type,
  folderId: marks.folders.get(`design:${row.id}`) ?? null,
  trashedAt: marks.trash.get(`design:${row.id}`) ?? null,
});

export const launchItem = (row: LaunchRow, marks: Marks): ProjectItem => ({
  kind: "launch",
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  artboards: row.boards.length,
  detail: "Launch pack",
  folderId: marks.folders.get(`launch:${row.id}`) ?? null,
  trashedAt: marks.trash.get(`launch:${row.id}`) ?? null,
});

/** Every design and launch project of the brand as one list of cards. */
export const itemsOf = (
  designs: readonly DesignRow[],
  launches: readonly LaunchRow[],
  placements: readonly PlacementRow[],
  trash: readonly TrashRow[],
): readonly ProjectItem[] => {
  const marks = marksOf(placements, trash);
  return [...designs.map((row) => designItem(row, marks)), ...launches.map((row) => launchItem(row, marks))];
};
