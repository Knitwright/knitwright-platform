import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getType, migrateSpec, repairSpec, type Dropped, type GarmentSpec } from "@/lib/garment";
import { AppError } from "@/lib/server/core/errors";
import { dropUnreadableArtwork } from "./artwork-files";
import { failureFromDatabase, NOT_FOUND_MESSAGE } from "./database-errors";
import {
  PROJECT_COLUMNS,
  VERSION_COLUMNS,
  projectRowSchema,
  versionRowSchema,
  versionWithSpecRowSchema,
} from "./rows";
import { PROJECTS_LISTED, UNDO_SCAN_LIMIT, VERSIONS_LISTED } from "./limits";
import type { HistoryRow } from "./undo";

/**
 * Designs and their versions. Every function takes the clients it needs. Reads go through
 * the signed-in user's own client, so the database decides what they may see. Writes go
 * through the server's own client and the project functions in the database, which check
 * that the user belongs to the brand. The brand always comes from the session.
 */

export { PROJECTS_LISTED, UNDO_SCAN_LIMIT, VERSIONS_LISTED };

export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly styleNumber: string;
  readonly season: string;
  readonly garmentType: string;
  /** The name people see for the garment type. */
  readonly garmentLabel: string;
  readonly currentVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OpenProject extends ProjectSummary {
  /** When the version that was read was saved. */
  readonly versionSavedAt: string;
  readonly spec: GarmentSpec;
  /** What had to be removed to make an old design fit today's rules. Usually empty. */
  readonly dropped: readonly Dropped[];
}

export interface VersionSummary {
  readonly version: number;
  readonly note: string;
  readonly restoredFrom: number | null;
  readonly createdAt: string;
}

export interface OpenVersion extends VersionSummary {
  readonly spec: GarmentSpec;
  readonly dropped: readonly Dropped[];
}

export type ProjectRow = z.output<typeof projectRowSchema>;
type Failing = Readonly<{ code?: string; hint?: string | null; message: string }> | null;

export const throwIfFailed = (error: Failing): void => {
  if (error) throw failureFromDatabase(error);
};

const summaryOf = (row: ProjectRow): ProjectSummary => ({
  id: row.id,
  name: row.name,
  styleNumber: row.style_number,
  season: row.season,
  garmentType: row.garment_type,
  garmentLabel: getType(row.garment_type)?.label ?? row.garment_type,
  currentVersion: row.current_version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const versionOf = (row: z.output<typeof versionRowSchema>): VersionSummary => ({
  version: row.version,
  note: row.note,
  restoredFrom: row.restored_from,
  createdAt: row.created_at,
});

/** One design of this brand. A design that is missing, or not this brand's, is not found. */
export const loadRow = async (client: SupabaseClient, brandId: string, projectId: string): Promise<ProjectRow> => {
  const { data, error } = await client
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("brand_id", brandId)
    .eq("id", projectId)
    .maybeSingle();
  throwIfFailed(error);
  if (!data) throw new AppError("not_found", NOT_FOUND_MESSAGE);
  return projectRowSchema.parse(data);
};

export type ReadSpec = Readonly<{ spec: GarmentSpec; dropped: readonly Dropped[] }>;

/**
 * Reads a stored design: upgrades an old format, and repairs a design that no longer
 * fits the registry. What the repair removed is returned so the person can be told.
 */
export const readSpec = (stored: unknown): ReadSpec => {
  const migrated = migrateSpec(stored);
  if (!migrated.ok) throw new AppError("unavailable", migrated.reason);
  if (!migrated.stale) return { spec: migrated.spec, dropped: [] };
  const repaired = repairSpec(migrated.spec);
  if (!repaired.ok) throw new AppError("unavailable", repaired.reason);
  return { spec: repaired.spec, dropped: repaired.dropped };
};

export const loadVersion = async (
  client: SupabaseClient,
  brandId: string,
  projectId: string,
  version: number,
) => {
  const { data, error } = await client
    .from("spec_versions")
    .select(`${VERSION_COLUMNS}, spec`)
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .eq("version", version)
    .maybeSingle();
  throwIfFailed(error);
  if (!data) throw new AppError("not_found", NOT_FOUND_MESSAGE);
  return versionWithSpecRowSchema.parse(data);
};

export interface ProjectsPage {
  readonly projects: ProjectSummary[];
  /** True when the brand has more designs than were read. */
  readonly hasMore: boolean;
}

/** The brand's newest designs, up to the limit. It reads one more, to know if there are others. */
export const listProjects = async (
  client: SupabaseClient,
  brandId: string,
  limit: number = PROJECTS_LISTED,
): Promise<ProjectsPage> => {
  const { data, error } = await client
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  throwIfFailed(error);
  const rows = z.array(projectRowSchema).parse(data);
  return { projects: rows.slice(0, limit).map(summaryOf), hasMore: rows.length > limit };
};

/**
 * A design at one of its versions, or at its current version when none is named. The version shown
 * is the one read: `currentVersion` says which it is. A version the design does not have is not found.
 */
export const getProjectAt = async (
  client: SupabaseClient,
  brandId: string,
  projectId: string,
  version?: number,
): Promise<OpenProject> => {
  const row = await loadRow(client, brandId, projectId);
  const at = version ?? row.current_version;
  const stored = await loadVersion(client, brandId, projectId, at);
  return {
    ...summaryOf(row),
    currentVersion: at,
    versionSavedAt: stored.created_at,
    ...(await dropUnreadableArtwork(client, brandId, readSpec(stored.spec))),
  };
};

/** A design with its current content. */
export const getProject = (client: SupabaseClient, brandId: string, projectId: string): Promise<OpenProject> =>
  getProjectAt(client, brandId, projectId);

export interface VersionsPage {
  readonly versions: VersionSummary[];
  /** True when the design has older versions than were read. */
  readonly hasMore: boolean;
}

/** The newest versions of a design, newest first, without their content. */
export const listVersions = async (
  client: SupabaseClient,
  brandId: string,
  projectId: string,
  limit: number = VERSIONS_LISTED,
): Promise<VersionsPage> => {
  await loadRow(client, brandId, projectId);
  const { data, error } = await client
    .from("spec_versions")
    .select(VERSION_COLUMNS)
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(limit + 1);
  throwIfFailed(error);
  const rows = z.array(versionRowSchema).parse(data);
  return { versions: rows.slice(0, limit).map(versionOf), hasMore: rows.length > limit };
};

/** The version a design is at now. */
export const currentVersion = async (
  client: SupabaseClient,
  brandId: string,
  projectId: string,
): Promise<number> => (await loadRow(client, brandId, projectId)).current_version;

/** Which version each version restored, for working out where an undo goes. */
export const historyRows = async (
  client: SupabaseClient,
  brandId: string,
  projectId: string,
): Promise<HistoryRow[]> => {
  const { data, error } = await client
    .from("spec_versions")
    .select("version, restored_from")
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(UNDO_SCAN_LIMIT);
  throwIfFailed(error);
  return z
    .array(versionRowSchema.pick({ version: true, restored_from: true }))
    .parse(data)
    .map((row) => ({ version: row.version, restoredFrom: row.restored_from }));
};

export const getVersion = async (
  client: SupabaseClient,
  brandId: string,
  projectId: string,
  version: number,
): Promise<OpenVersion> => {
  await loadRow(client, brandId, projectId);
  const row = await loadVersion(client, brandId, projectId, version);
  return { ...versionOf(row), ...(await dropUnreadableArtwork(client, brandId, readSpec(row.spec))) };
};
