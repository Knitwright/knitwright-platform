import type { Route } from "next";
import { z } from "zod";

/**
 * AI Creations (09 screen 14): the pictures the brand's AI runs made, newest first, as a masonry
 * grid. Two tables hold them today: a shoot's picture (`shoot_jobs`, F-L1, always made with the
 * garment locked to a Design board) and a media set's lifestyle picture (`media_items`). Videos are
 * read by the server's own key only (decision 0058), so they are not listed here yet.
 */

export const CREATION_FILTERS = ["all", "scenes", "lifestyle", "locked"] as const;
export type CreationFilter = (typeof CREATION_FILTERS)[number];

export const FILTER_LABELS: Readonly<Record<CreationFilter, string>> = {
  all: "All",
  scenes: "Scenes",
  lifestyle: "Lifestyle",
  locked: "Garment-locked",
};

export const filterFromQuery = (value: string | readonly string[] | undefined): CreationFilter => {
  const asked = Array.isArray(value) ? value[0] : value;
  return CREATION_FILTERS.find((filter) => filter === asked) ?? "all";
};

/** A picture's shape, as a CSS aspect ratio. */
export type Shape = "square" | "portrait" | "tall" | "wide";

export interface Creation {
  readonly id: string;
  readonly source: "scene" | "lifestyle";
  readonly fileId: string;
  readonly shape: Shape;
  readonly garmentLocked: boolean;
  readonly createdAt: string;
  /** Where the picture was made: the launch canvas, or the design. */
  readonly href: Route;
  readonly label: string;
}

export const shootRow = z.object({
  id: z.uuid(),
  launch_project_id: z.uuid(),
  aspect: z.string(),
  output_file_id: z.uuid(),
  finished_at: z.string(),
});

export const lifestyleRow = z.object({
  id: z.uuid(),
  file_id: z.uuid(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  created_at: z.string(),
  media_sets: z.object({ project_id: z.uuid() }),
});

const ASPECTS: Readonly<Record<string, Shape>> = { "1:1": "square", "4:5": "portrait", "9:16": "tall", "16:9": "wide", match: "portrait" };

/** The shape of a picture of this width and height; square when either is unknown. */
export const shapeOf = (width: number | null, height: number | null): Shape => {
  if (!width || !height) return "square";
  const ratio = width / height;
  if (ratio >= 1.3) return "wide";
  if (ratio <= 0.65) return "tall";
  if (ratio < 0.95) return "portrait";
  return "square";
};

export const sceneOf = (row: z.output<typeof shootRow>): Creation => ({
  id: row.id,
  source: "scene",
  fileId: row.output_file_id,
  shape: ASPECTS[row.aspect] ?? "square",
  garmentLocked: true,
  createdAt: row.finished_at,
  href: `/launch/${row.launch_project_id}` as Route,
  label: "AI scene",
});

export const lifestyleOf = (row: z.output<typeof lifestyleRow>): Creation => ({
  id: row.id,
  source: "lifestyle",
  fileId: row.file_id,
  shape: shapeOf(row.width, row.height),
  garmentLocked: false,
  createdAt: row.created_at,
  href: `/studio/${row.media_sets.project_id}` as Route,
  label: "Lifestyle picture",
});

/** The creations one filter shows, newest first. */
export const visibleCreations = (creations: readonly Creation[], filter: CreationFilter): readonly Creation[] =>
  creations
    .filter((creation) => {
      if (filter === "scenes") return creation.source === "scene";
      if (filter === "lifestyle") return creation.source === "lifestyle";
      if (filter === "locked") return creation.garmentLocked;
      return true;
    })
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
