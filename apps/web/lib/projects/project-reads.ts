import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getType, migrateSpec, repairSpec, type Dropped, type GarmentSpec } from "@/lib/garment";
import { AppError } from "@/lib/server/core/errors";
import { failureFromDatabase, NOT_FOUND_MESSAGE } from "./database-errors";
import {
  PROJECT_COLUMNS,
  VERSION_COLUMNS,
  projectRowSchema,
  versionRowSchema,
  versionWithSpecRowSchema,
} from "./rows";

/**
 * Designs and their versions. Every function takes the clients it needs. Reads go through
 * the signed-in user's own client, so the database decides what they may see. Writes go
 * through the server's own client and the project functions in the database, which check
 * that the user belongs to the brand. The brand always comes from the session.
 */

/** The most versions the history lists. */
export const VERSIONS_LISTED = 100;

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

export const listProjects = async (client: SupabaseClient, brandId: string): Promise<ProjectSummary[]> => {
  const { data, error } = await client
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  throwIfFailed(error);
  return z.array(projectRowSchema).parse(data).map(summaryOf);
};

/** A design with its current content. */
export const getProject = async (
  client: SupabaseClient,
  brandId: string,
  projectId: string,
): Promise<OpenProject> => {
  const row = await loadRow(client, brandId, projectId);
  const current = await loadVersion(client, brandId, projectId, row.current_version);
  return { ...summaryOf(row), ...readSpec(current.spec) };
};

/** The newest versions of a design, newest first, without their content. */
export const listVersions = async (
  client: SupabaseClient,
  brandId: string,
  projectId: string,
): Promise<VersionSummary[]> => {
  await loadRow(client, brandId, projectId);
  const { data, error } = await client
    .from("spec_versions")
    .select(VERSION_COLUMNS)
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(VERSIONS_LISTED);
  throwIfFailed(error);
  return z.array(versionRowSchema).parse(data).map(versionOf);
};

export const getVersion = async (
  client: SupabaseClient,
  brandId: string,
  projectId: string,
  version: number,
): Promise<OpenVersion> => {
  await loadRow(client, brandId, projectId);
  const row = await loadVersion(client, brandId, projectId, version);
  return { ...versionOf(row), ...readSpec(row.spec) };
};
