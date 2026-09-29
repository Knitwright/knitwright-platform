import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  applyAction,
  specActionSchema,
  type Dropped,
  type GarmentSpec,
  type Wearer,
} from "@/lib/garment";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { CONFLICT_MESSAGE } from "./database-errors";
import { describeAction, restoreNote } from "./notes";
import { loadRow, loadVersion, readSpec, throwIfFailed } from "./project-reads";
import { startingSpec } from "./starting-spec";

export * from "./project-reads";

/**
 * Changes to designs. They go through the server's own client and the project functions
 * in the database, which check that the user belongs to the brand. The brand always comes
 * from the session. Reads are in project-reads.ts and are exported from here as well.
 */

const ALREADY_CURRENT = "That is already the current version.";
const NOT_UNDERSTOOD = "That change is not understood.";

export type SaveOutcome =
  | Readonly<{ ok: true; spec: GarmentSpec; version: number; dropped: readonly Dropped[] }>
  | Readonly<{ ok: false; reason: string }>;

export type NewProject = Readonly<{
  brandId: string;
  userId: string;
  name: string;
  styleNumber: string;
  season: string;
  typeId: string;
  wearer: Wearer;
}>;

/** Makes a design and its first version. Returns the design's id. */
export const createProject = async (admin: SupabaseClient, input: NewProject): Promise<string> => {
  const started = startingSpec(input.typeId, input.wearer);
  if (!started.ok) {
    throw new AppError("invalid_input", MESSAGES.invalid_input, { typeId: [started.reason] });
  }
  const { data, error } = await admin.rpc("create_project", {
    p_brand_id: input.brandId,
    p_user_id: input.userId,
    p_name: input.name,
    p_style_number: input.styleNumber,
    p_season: input.season,
    p_garment_type: started.spec.typeId,
    p_spec: started.spec,
    p_schema_version: started.spec.schemaVersion,
  });
  throwIfFailed(error);
  return z.uuid().parse(data);
};

type Append = Readonly<{
  userId: string;
  projectId: string;
  expectedVersion: number;
  spec: GarmentSpec;
  note: string;
  restoredFrom: number | null;
}>;

/** Stores a design as the next version. The database refuses if the version has moved on. */
const appendVersion = async (admin: SupabaseClient, input: Append): Promise<number> => {
  const { data, error } = await admin.rpc("append_spec_version", {
    p_project_id: input.projectId,
    p_user_id: input.userId,
    p_expected_version: input.expectedVersion,
    p_spec: input.spec,
    p_schema_version: input.spec.schemaVersion,
    p_note: input.note,
    p_restored_from: input.restoredFrom,
  });
  throwIfFailed(error);
  return z.number().int().min(1).parse(data);
};

export type SaveInput = Readonly<{
  brandId: string;
  userId: string;
  projectId: string;
  /** The version the person was looking at when they made the change. */
  expectedVersion: number;
  action: unknown;
}>;

/**
 * Applies one change to the current design and stores the result as a new version. A
 * change the garment rules refuse stores nothing and comes back with the reason. A change
 * that leaves the design as it was stores nothing either. If the design has moved on
 * since the person loaded it, the answer is a conflict.
 */
export const saveAction = async (
  admin: SupabaseClient,
  client: SupabaseClient,
  input: SaveInput,
): Promise<SaveOutcome> => {
  const row = await loadRow(client, input.brandId, input.projectId);
  if (row.current_version !== input.expectedVersion) throw new AppError("conflict", CONFLICT_MESSAGE);
  const current = await loadVersion(client, input.brandId, input.projectId, row.current_version);
  const base = readSpec(current.spec);

  const action = specActionSchema.safeParse(input.action);
  if (!action.success) return { ok: false, reason: NOT_UNDERSTOOD };
  const applied = applyAction(base.spec, action.data);
  if (!applied.ok) return applied;

  const dropped = [...base.dropped, ...applied.dropped];
  if (JSON.stringify(applied.spec) === JSON.stringify(base.spec)) {
    return { ok: true, spec: applied.spec, version: row.current_version, dropped };
  }
  const version = await appendVersion(admin, {
    userId: input.userId,
    projectId: input.projectId,
    expectedVersion: input.expectedVersion,
    spec: applied.spec,
    note: describeAction(base.spec, action.data),
    restoredFrom: null,
  });
  return { ok: true, spec: applied.spec, version, dropped };
};

export type RestoreInput = Readonly<{
  brandId: string;
  userId: string;
  projectId: string;
  expectedVersion: number;
  /** The version to go back to. */
  version: number;
}>;

/** Stores an old version's design as a new version. Nothing already saved is changed. */
export const restoreVersion = async (
  admin: SupabaseClient,
  client: SupabaseClient,
  input: RestoreInput,
): Promise<SaveOutcome> => {
  const row = await loadRow(client, input.brandId, input.projectId);
  if (row.current_version !== input.expectedVersion) throw new AppError("conflict", CONFLICT_MESSAGE);
  if (input.version === row.current_version) return { ok: false, reason: ALREADY_CURRENT };

  const old = await loadVersion(client, input.brandId, input.projectId, input.version);
  const { spec, dropped } = readSpec(old.spec);
  const version = await appendVersion(admin, {
    userId: input.userId,
    projectId: input.projectId,
    expectedVersion: input.expectedVersion,
    spec,
    note: restoreNote(input.version),
    restoredFrom: input.version,
  });
  return { ok: true, spec, version, dropped };
};

export type RenameInput = Readonly<{
  brandId: string;
  userId: string;
  projectId: string;
  name: string;
  styleNumber: string;
  season: string;
}>;

/** Changes a design's name, style number and season. They are not versioned. */
export const renameProject = async (
  admin: SupabaseClient,
  client: SupabaseClient,
  input: RenameInput,
): Promise<void> => {
  await loadRow(client, input.brandId, input.projectId);
  const { error } = await admin.rpc("rename_project", {
    p_project_id: input.projectId,
    p_user_id: input.userId,
    p_name: input.name,
    p_style_number: input.styleNumber,
    p_season: input.season,
  });
  throwIfFailed(error);
};
