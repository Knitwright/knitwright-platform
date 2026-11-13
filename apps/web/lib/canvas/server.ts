import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isGarmentKind, type BoardView } from "@/lib/launch";
import { flatPreview } from "@/lib/projects/flat-preview";
import { getProject } from "@/lib/projects/service";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { readValidationResults } from "@/lib/validation/results";
import { isUuid } from "./address";
import type { GarmentPreview } from "./types";

/**
 * Joins the one canvas to the database (decision 0145). It holds no rules of its own: the address,
 * the mapping, the boxes and the store are pure and tested on their own, and the database and
 * end-to-end tests cover the joining. Every read is through the member's own client, so row level
 * security decides what is seen.
 */

export interface CanvasRecord {
  /** The canvas: a `launch_projects` row. */
  readonly canvasId: string;
  /** The design this canvas is the home of, or null for a launch canvas. */
  readonly studioProjectId: string | null;
}

const recordRow = z.object({ id: z.uuid(), studio_project_id: z.uuid().nullable() });

/** The canvas an address's id names -- the canvas's own id or a design's -- or null. */
export async function resolveCanvas(client: SupabaseClient, brandId: string, id: string): Promise<CanvasRecord | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await client
    .from("launch_projects")
    .select("id, studio_project_id")
    .eq("brand_id", brandId)
    .or(`id.eq.${id},studio_project_id.eq.${id}`)
    .limit(1)
    .maybeSingle();
  if (error) throw new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  if (data === null) return null;
  const row = recordRow.parse(data);
  return { canvasId: row.id, studioProjectId: row.studio_project_id };
}

const designOf = (board: BoardView): string | null => {
  const value = board.settings["designProjectId"];
  return isGarmentKind(board.kind) && typeof value === "string" && isUuid(value) ? value : null;
};

/**
 * What every garment board on the canvas shows: its design's front flat at the current version and
 * the result of the last validation of that version. A design that cannot be read (removed, or not
 * this brand's) is null, and the board says so; it never stops the canvas opening.
 */
export async function garmentPreviews(client: SupabaseClient, brandId: string, boards: readonly BoardView[]): Promise<Readonly<Record<string, GarmentPreview | null>>> {
  const ids = [...new Set(boards.map(designOf).filter((id): id is string => id !== null))];
  const entries = await Promise.all(ids.map(async (id) => [id, await previewOf(client, brandId, id)] as const));
  return Object.fromEntries(entries);
}

async function previewOf(client: SupabaseClient, brandId: string, designId: string): Promise<GarmentPreview | null> {
  const project = await getProject(client, brandId, designId).catch(() => null);
  if (project === null) return null;
  const results = await readValidationResults(client, brandId, designId, project.currentVersion).catch(() => []);
  const front = flatPreview(project.spec, new Map())?.views[0] ?? null;
  const latest = results[0] ?? null;
  return {
    designProjectId: designId,
    name: project.name,
    version: project.currentVersion,
    src: front?.src ?? null,
    alt: front?.alt ?? `${project.name}, not drawn yet`,
    checks: latest === null ? null : { passed: latest.passed, count: latest.checks.filter((check) => !check.passed).length },
  };
}
