import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  applyAction,
  specActionSchema,
  type Dropped,
  type GarmentSpec,
  type SpecAction,
  type Wearer,
} from "@/lib/garment";
import type { ChartSet } from "@/lib/sizing";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { refuseUnreadableArtwork, dropUnreadableArtwork } from "./artwork-files";
import { browserActionSchema } from "./browser-action";
import { CONFLICT_MESSAGE } from "./database-errors";
import { describeAction, describeProposal, restoreNote, type ProposalSource } from "./notes";
import { historyRows, loadRow, loadVersion, readSpec, throwIfFailed, type ReadSpec } from "./project-reads";
import { sameDesign } from "./same-design";
import { undoTarget } from "./undo";
import { startingSpec } from "./starting-spec";

export * from "./project-reads";

/**
 * Changes to designs. They go through the server's own client and the project functions
 * in the database, which check that the user belongs to the brand. The brand always comes
 * from the session. Reads are in project-reads.ts and are exported from here as well.
 */

const ALREADY_CURRENT = "That is already the current version.";
const NOT_UNDERSTOOD = "That change is not understood.";
const NOTHING_TO_UNDO = "There is nothing to undo.";

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
  /** The brand's charts. A new design takes its sizes from the one that applies. */
  charts?: ChartSet;
}>;

/** Makes a design and its first version. Returns the design's id. */
export const createProject = async (admin: SupabaseClient, input: NewProject): Promise<string> => {
  const started = startingSpec(input.typeId, input.wearer, input.charts);
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

type Current = Readonly<{ version: number; read: ReadSpec }>;

/** The design as it is now. A person looking at an older version gets a conflict. */
const loadCurrent = async (
  client: SupabaseClient,
  input: Pick<SaveInput, "brandId" | "projectId" | "expectedVersion">,
): Promise<Current> => {
  const row = await loadRow(client, input.brandId, input.projectId);
  if (row.current_version !== input.expectedVersion) throw new AppError("conflict", CONFLICT_MESSAGE);
  const current = await loadVersion(client, input.brandId, input.projectId, row.current_version);
  const read = await dropUnreadableArtwork(client, input.brandId, readSpec(current.spec));
  return { version: row.current_version, read };
};

/** Applies a change that has already been parsed, and stores the result if it changed anything. */
const storeAction = async (
  admin: SupabaseClient,
  client: SupabaseClient,
  input: SaveInput,
  current: Current,
  action: SpecAction,
): Promise<SaveOutcome> => {
  const { spec: base, dropped: repaired } = current.read;
  const refusal = await refuseUnreadableArtwork(client, input.brandId, action);
  if (refusal) return { ok: false, reason: refusal };
  const applied = applyAction(base, action);
  if (!applied.ok) return applied;

  const dropped = [...repaired, ...applied.dropped];
  if (sameDesign(applied.spec, base)) return { ok: true, spec: applied.spec, version: current.version, dropped };
  const version = await appendVersion(admin, {
    userId: input.userId,
    projectId: input.projectId,
    expectedVersion: input.expectedVersion,
    spec: applied.spec,
    note: describeAction(base, action),
    restoredFrom: null,
  });
  return { ok: true, spec: applied.spec, version, dropped };
};

/**
 * Applies one change from a browser to the current design and stores the result as a new
 * version. Whatever source the browser claims for a value is thrown away: everything it
 * sends is stamped `user-edited`. A change the garment rules refuse stores nothing and
 * comes back with the reason. A change that leaves the design as it was stores nothing
 * either. If the design has moved on since the person loaded it, the answer is a conflict.
 */
export const saveAction = async (
  admin: SupabaseClient,
  client: SupabaseClient,
  input: SaveInput,
): Promise<SaveOutcome> => {
  const current = await loadCurrent(client, input);
  const action = browserActionSchema.safeParse(input.action);
  if (!action.success) return { ok: false, reason: NOT_UNDERSTOOD };
  return storeAction(admin, client, input, current, action.data);
};

/**
 * For the server's own trusted writers only: a size chart, the assistant, reading a
 * picture. The change keeps the source it names. Nothing that comes from a browser may
 * reach this function. Use `saveAction` for that.
 */
export const saveTrustedAction = async (
  admin: SupabaseClient,
  client: SupabaseClient,
  input: SaveInput & Readonly<{ action: SpecAction }>,
): Promise<SaveOutcome> => {
  const current = await loadCurrent(client, input);
  const action = specActionSchema.safeParse(input.action);
  if (!action.success) return { ok: false, reason: NOT_UNDERSTOOD };
  return storeAction(admin, client, input, current, action.data);
};

export type TrustedBatchInput = Omit<SaveInput, "action"> &
  Readonly<{
    actions: readonly SpecAction[];
    source: ProposalSource;
    /** The sentences that explain the changes, used for the version note. */
    explanations: readonly string[];
  }>;

/**
 * For the assistant only: applies a batch of changes the server itself proposed, all or
 * none, and stores the result as ONE version, so one undo takes the whole batch back.
 * Each change keeps the source it names. Nothing a browser wrote may reach this function;
 * a browser can only hand back a proposal the server signed (lib/intent/proposal-token.ts).
 */
export const saveTrustedActions = async (
  admin: SupabaseClient,
  client: SupabaseClient,
  input: TrustedBatchInput,
): Promise<SaveOutcome> => {
  const current = await loadCurrent(client, input);
  let spec = current.read.spec;
  const dropped: Dropped[] = [...current.read.dropped];
  for (const raw of input.actions) {
    const action = specActionSchema.safeParse(raw);
    if (!action.success) return { ok: false, reason: NOT_UNDERSTOOD };
    const refusal = await refuseUnreadableArtwork(client, input.brandId, action.data);
    if (refusal) return { ok: false, reason: refusal };
    const applied = applyAction(spec, action.data);
    if (!applied.ok) return applied;
    dropped.push(...applied.dropped);
    spec = applied.spec;
  }
  if (sameDesign(spec, current.read.spec)) return { ok: true, spec, version: current.version, dropped };
  const version = await appendVersion(admin, {
    userId: input.userId,
    projectId: input.projectId,
    expectedVersion: input.expectedVersion,
    spec,
    note: describeProposal(input.source, input.explanations),
    restoredFrom: null,
  });
  return { ok: true, spec, version, dropped };
};

/** The design as it is now, for the assistant to read. A person looking at an older version gets a conflict. */
export const loadCurrentDesign = async (
  client: SupabaseClient,
  input: Pick<SaveInput, "brandId" | "projectId" | "expectedVersion">,
): Promise<GarmentSpec> => (await loadCurrent(client, input)).read.spec;

export type RestoreInput = Readonly<{
  brandId: string;
  userId: string;
  projectId: string;
  expectedVersion: number;
  /** The version to go back to. */
  version: number;
}>;

/**
 * Stores an old version's design as a new version. Nothing already saved is changed. If
 * the design is already the same as the current one, nothing is stored.
 */
export const restoreVersion = async (
  admin: SupabaseClient,
  client: SupabaseClient,
  input: RestoreInput,
): Promise<SaveOutcome> => {
  const current = await loadCurrent(client, input);
  if (input.version === current.version) return { ok: false, reason: ALREADY_CURRENT };

  const old = await loadVersion(client, input.brandId, input.projectId, input.version);
  const { spec, dropped } = await dropUnreadableArtwork(client, input.brandId, readSpec(old.spec));
  if (sameDesign(spec, current.read.spec)) return { ok: true, spec, version: current.version, dropped };
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

export type UndoInput = Omit<RestoreInput, "version">;

/**
 * Goes back one design, as a new version. The target is worked out here, from the version
 * the request runs at, so it can never be stale. See `undoTarget`.
 */
export const undoDesign = async (
  admin: SupabaseClient,
  client: SupabaseClient,
  input: UndoInput,
): Promise<SaveOutcome> => {
  await loadCurrent(client, input);
  const target = undoTarget(await historyRows(client, input.brandId, input.projectId));
  if (target === null) return { ok: false, reason: NOTHING_TO_UNDO };
  return restoreVersion(admin, client, { ...input, version: target });
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
