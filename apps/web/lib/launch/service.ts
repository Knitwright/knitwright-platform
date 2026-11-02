import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { refusal } from "@/lib/make/service";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { fileProvenanceOf, UNKNOWN_PROVENANCE, type FileProvenance } from "@/lib/storage/provenance";
import { ARTBOARD_UNITS } from "./artboard";
import { acceptOffer, type AssetOffer } from "./assets";
import { BOARD_KINDS, BOARD_STATUSES, OUTPUT_ROLES, type BoardKind, type BoardStatus } from "./boards";
import type { ConnectBoardsBody, CreateLaunchProjectBody, LaunchSnapshot, SaveBoardBody, SaveLaunchProjectBody } from "./schemas";
import type { ArtboardPreset, BoardView, LaunchProjectSummary, LaunchProjectView, LaunchVersion } from "./types";

/**
 * The launch tables (migration 20261201010000). Reads go through the client the caller passes,
 * which in a page is the member's own, so the database's own rules decide what is seen. Every write
 * goes through the server's client and one of that migration's functions, each of which checks the
 * person's role itself; the brand and the person always come from the session.
 *
 * `recordOutput` is the one door to a board's output. It reads what made the file from the file's
 * own row and then asks `acceptOffer`, so a generated picture cannot be written down as artwork
 * here any more than it can in the database (spec decision 13; security review v5 H1, which found
 * that the provenance used to come from the request body).
 */

const NOT_FOUND = "That launch project does not exist.";

export type Who = Readonly<{ brandId: string; userId: string }>;

const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

const colourRow = z.object({ hex: z.string(), name: z.string() });

const boardRow = z.object({
  id: z.uuid(),
  kind: z.enum(BOARD_KINDS),
  name: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
  settings: z.record(z.string(), z.unknown()),
  input_version: z.number().int().nullable(),
  output_file_id: z.uuid().nullable(),
  output_role: z.enum(OUTPUT_ROLES),
  status: z.enum(BOARD_STATUSES),
  last_cost_credits: z.number().int().nullable(),
  rule_id: z.string(),
});

const edgeRow = z.object({ id: z.uuid(), from_board_id: z.uuid(), to_board_id: z.uuid(), input_index: z.number().int() });

const projectRow = z.object({
  id: z.uuid(),
  brand_id: z.uuid(),
  name: z.string(),
  units: z.enum(ARTBOARD_UNITS),
  colours: z.array(colourRow),
  design_project_id: z.uuid().nullable(),
  updated_at: z.string(),
  boards: z.array(boardRow),
  board_edges: z.array(edgeRow),
});

const summaryRow = z.object({
  id: z.uuid(),
  name: z.string(),
  units: z.enum(ARTBOARD_UNITS),
  updated_at: z.string(),
  boards: z.array(z.object({ id: z.uuid() })),
});

const presetRow = z.object({
  key: z.string(),
  label: z.string(),
  width: z.coerce.number(),
  height: z.coerce.number(),
  unit: z.enum(ARTBOARD_UNITS),
  dpi: z.number().int(),
  rule_id: z.string(),
  note: z.string(),
});

const versionRow = z.object({ id: z.uuid(), version: z.number().int(), created_at: z.string(), snapshot: z.unknown() });

const BOARD_COLUMNS =
  "id, kind, name, x, y, width, height, settings, input_version, output_file_id, output_role, status, last_cost_credits, rule_id";

const PROJECT_SELECT = [
  "id, brand_id, name, units, colours, design_project_id, updated_at",
  `boards(${BOARD_COLUMNS})`,
  "board_edges(id, from_board_id, to_board_id, input_index)",
].join(", ");

const boardOf = (row: z.output<typeof boardRow>): BoardView => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  at: { x: row.x, y: row.y },
  size: { width: row.width, height: row.height },
  settings: row.settings,
  inputVersion: row.input_version,
  outputFileId: row.output_file_id,
  outputRole: row.output_role,
  status: row.status,
  lastCostCredits: row.last_cost_credits,
  ruleId: row.rule_id,
});

/** One canvas with its boards and connectors, or null when there is no such canvas. */
export async function loadLaunchProject(client: SupabaseClient, brandId: string, launchProjectId: string): Promise<LaunchProjectView | null> {
  const { data, error } = await client.from("launch_projects").select(PROJECT_SELECT).eq("brand_id", brandId).eq("id", launchProjectId).maybeSingle();
  if (error) throw unreadable(error);
  if (data === null) return null;
  const row = projectRow.safeParse(data);
  if (!row.success) throw unreadable(row.error);
  return {
    id: row.data.id,
    brandId: row.data.brand_id,
    name: row.data.name,
    units: row.data.units,
    colours: row.data.colours,
    designProjectId: row.data.design_project_id,
    // The canvas has no order of its own in the database. Boards are read left to right and then
    // top to bottom, so the canvas, the layer list and a keyboard walk agree with each other.
    boards: [...row.data.boards].sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id)).map(boardOf),
    edges: row.data.board_edges.map((edge) => ({ id: edge.id, fromBoardId: edge.from_board_id, toBoardId: edge.to_board_id, inputIndex: edge.input_index })),
    updatedAt: row.data.updated_at,
  };
}

/** Every canvas of the brand, most recently changed first, with how many boards it holds. */
export async function listLaunchProjects(client: SupabaseClient, brandId: string): Promise<readonly LaunchProjectSummary[]> {
  const { data, error } = await client
    .from("launch_projects")
    .select("id, name, units, updated_at, boards(id)")
    .eq("brand_id", brandId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw unreadable(error);
  const rows = z.array(summaryRow).safeParse(data ?? []);
  if (!rows.success) throw unreadable(rows.error);
  return rows.data.map((row) => ({ id: row.id, name: row.name, units: row.units, boards: row.boards.length, updatedAt: row.updated_at }));
}

/** The artboard sizes. Platform data every signed-in member may read, and nobody in the app writes. */
export async function listArtboardPresets(client: SupabaseClient): Promise<readonly ArtboardPreset[]> {
  const { data, error } = await client.from("launch_artboard_presets").select("key, label, width, height, unit, dpi, rule_id, note").order("sort");
  if (error) throw unreadable(error);
  const rows = z.array(presetRow).safeParse(data ?? []);
  if (!rows.success) throw unreadable(rows.error);
  return rows.data.map((row) => ({
    key: row.key,
    label: row.label,
    width: row.width,
    height: row.height,
    unit: row.unit,
    dpi: row.dpi,
    ruleId: row.rule_id,
    note: row.note,
  }));
}

/** The saved versions of a canvas, newest first, for the main menu's Version history. */
export async function listLaunchVersions(client: SupabaseClient, brandId: string, launchProjectId: string): Promise<readonly LaunchVersion[]> {
  const { data, error } = await client
    .from("launch_project_versions")
    .select("id, version, created_at, snapshot")
    .eq("brand_id", brandId)
    .eq("launch_project_id", launchProjectId)
    .order("version", { ascending: false })
    .limit(50);
  if (error) throw unreadable(error);
  const rows = z.array(versionRow).safeParse(data ?? []);
  if (!rows.success) throw unreadable(rows.error);
  return rows.data.map((row) => ({
    id: row.id,
    version: row.version,
    boards: Array.isArray((row.snapshot as { boards?: unknown })?.boards) ? ((row.snapshot as { boards: unknown[] }).boards.length) : 0,
    createdAt: row.created_at,
  }));
}

export const createLaunchProject = async (admin: SupabaseClient, who: Who, input: CreateLaunchProjectBody): Promise<string> => {
  const { data, error } = await admin.rpc("create_launch_project", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_name: input.name,
    p_units: input.units,
    p_design_project_id: input.designProjectId,
  });
  if (error) throw refusal(error, NOT_FOUND);
  return z.uuid().parse(data);
};

export const saveLaunchProject = async (admin: SupabaseClient, who: Who, input: SaveLaunchProjectBody): Promise<string> => {
  const { data, error } = await admin.rpc("save_launch_project", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_launch_project_id: input.launchProjectId,
    p_name: input.name,
    p_units: input.units,
    p_colours: input.colours,
  });
  if (error) throw refusal(error, NOT_FOUND);
  return z.uuid().parse(data);
};

export const removeLaunchProject = async (admin: SupabaseClient, who: Who, launchProjectId: string): Promise<void> => {
  const { error } = await admin.rpc("remove_launch_project", { p_brand_id: who.brandId, p_user_id: who.userId, p_launch_project_id: launchProjectId });
  if (error) throw refusal(error, NOT_FOUND);
};

export const saveBoard = async (admin: SupabaseClient, who: Who, input: SaveBoardBody): Promise<string> => {
  const { data, error } = await admin.rpc("save_launch_board", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_launch_project_id: input.launchProjectId,
    p_board_id: input.boardId,
    p_kind: input.kind,
    p_name: input.name,
    p_x: input.x,
    p_y: input.y,
    p_width: input.width,
    p_height: input.height,
    p_settings: input.settings,
    p_input_version: input.inputVersion,
  });
  if (error) throw refusal(error, "That board does not exist.");
  return z.uuid().parse(data);
};

export const removeBoard = async (admin: SupabaseClient, who: Who, boardId: string): Promise<void> => {
  const { error } = await admin.rpc("remove_launch_board", { p_brand_id: who.brandId, p_user_id: who.userId, p_board_id: boardId });
  if (error) throw refusal(error, "That board does not exist.");
};

export const connectBoards = async (admin: SupabaseClient, who: Who, input: ConnectBoardsBody): Promise<string> => {
  const { data, error } = await admin.rpc("connect_launch_boards", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_from_board_id: input.fromBoardId,
    p_to_board_id: input.toBoardId,
    p_input_index: input.inputIndex,
  });
  if (error) throw refusal(error, "That board does not exist.");
  return z.uuid().parse(data);
};

export const disconnectBoards = async (admin: SupabaseClient, who: Who, edgeId: string): Promise<void> => {
  const { error } = await admin.rpc("disconnect_launch_boards", { p_brand_id: who.brandId, p_user_id: who.userId, p_edge_id: edgeId });
  if (error) throw refusal(error, "That connector does not exist.");
};

/**
 * What really made the file this brand is offering, from the file's own row.
 *
 * The one read behind the garment lock (security review v5 H1, decision 0116). It is scoped to the
 * brand, so a file of another brand is not found at all; a row that is there but says something
 * this release does not recognise falls back to the restrictive value, as
 * `lib/storage/provenance.ts` does.
 */
async function provenanceOfFile(admin: SupabaseClient, brandId: string, fileId: string): Promise<FileProvenance> {
  const { data, error } = await admin.from("files").select("provenance").eq("id", fileId).eq("brand_id", brandId).maybeSingle();
  if (error) throw new AppError("conflict", "That file could not be read.");
  if (data === null) throw new AppError("not_found", "That file does not exist.");
  return fileProvenanceOf((data as { provenance?: unknown }).provenance);
}

/**
 * Which of these files a model made, from the files' own rows.
 *
 * For the Store hand-off, whose "AI-generated" label the spec makes mandatory and which used to be
 * worked out from the shape of the canvas alone (security review v5 H1, decision 0116). Scoped to
 * the brand, and a file whose row cannot be read is counted as a model's, which is the strict
 * answer: a label is cheap and a missing one is not.
 */
export async function generatedOutputFiles(admin: SupabaseClient, brandId: string, fileIds: readonly string[]): Promise<readonly string[]> {
  if (fileIds.length === 0) return [];
  const { data, error } = await admin.from("files").select("id, provenance").eq("brand_id", brandId).in("id", [...fileIds]);
  if (error) throw new AppError("conflict", "Those files could not be read.");
  const rows = z.array(z.object({ id: z.uuid(), provenance: z.string() })).parse(data ?? []);
  const known = new Map(rows.map((row) => [row.id, fileProvenanceOf(row.provenance)]));
  return fileIds.filter((id) => (known.get(id) ?? UNKNOWN_PROVENANCE) === "generated");
}

/**
 * Records what a run produced.
 *
 * **The provenance is read from the file's own row, never taken from the caller.** That is the
 * whole of H1: the offer says which file and what the panel wants it used as, and the server
 * decides what the file is. `acceptOffer` then decides the role, so a picture a model made is
 * written down as scenery and can never be written down as a layer on the garment or part of a
 * print file. The database refuses the same thing again, twice -- the file's provenance in
 * `set_launch_board_output` and `boards_generated_output_is_never_artwork` on the row.
 */
export async function recordOutput(
  admin: SupabaseClient,
  who: Who,
  input: Readonly<{ boardId: string; kind: BoardKind; offer: AssetOffer | null; status: BoardStatus; credits: number | null }>,
): Promise<void> {
  const provenance = input.offer === null ? null : await provenanceOfFile(admin, who.brandId, input.offer.file.fileId);
  const verdict = input.offer === null || provenance === null ? null : acceptOffer(input.kind, input.offer, provenance);
  if (verdict && !verdict.accepted) throw new AppError("conflict", verdict.reason);
  const { error } = await admin.rpc("set_launch_board_output", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_board_id: input.boardId,
    p_output_file_id: input.offer === null ? null : input.offer.file.fileId,
    p_output_role: verdict?.accepted ? verdict.role : "asset",
    p_status: input.status,
    p_last_cost_credits: input.credits,
  });
  if (error) throw refusal(error, "That board does not exist.");
}

/** The main menu's Save: the canvas as it stands, with the next version number. */
export async function saveLaunchVersion(admin: SupabaseClient, who: Who, launchProjectId: string, snapshot: LaunchSnapshot): Promise<number> {
  const { data, error } = await admin.rpc("save_launch_project_version", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_launch_project_id: launchProjectId,
    p_snapshot: snapshot,
  });
  if (error) throw refusal(error, NOT_FOUND);
  const rows = z.array(z.object({ id: z.uuid(), version: z.number().int() })).parse(data);
  return rows[0]?.version ?? 1;
}

/** The canvas as a snapshot, for the Save menu item. Pure enough to test, so it lives beside the writes. */
export function snapshotOf(project: LaunchProjectView, now: Date): LaunchSnapshot {
  return {
    kind: "launch-canvas",
    snapshotVersion: 1,
    savedAt: now.toISOString(),
    units: project.units,
    colours: [...project.colours],
    boards: project.boards.map((one) => ({
      id: one.id,
      kind: one.kind,
      name: one.name,
      x: one.at.x,
      y: one.at.y,
      width: one.size.width,
      height: one.size.height,
      settings: { ...one.settings },
      inputVersion: one.inputVersion,
      status: one.status,
    })),
    edges: project.edges.map((edge) => ({ fromBoardId: edge.fromBoardId, toBoardId: edge.toBoardId, inputIndex: edge.inputIndex })),
  };
}
