import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { CONCEPT_COLUMNS, JOB_COLUMNS, POSE_COLUMNS, PRESET_COLUMNS, conceptFromRow, jobRow, poseFromRow, presetFromRow, type ShootJobRow } from "./schemas";
import type { ModelPreset, ShootConcept, ShootPose } from "./types";

/**
 * READING THE SHOOT LIBRARY AND A BOARD'S OWN RUNS (plan v5 L3).
 *
 * The library is platform data, so it is read with the signed-in member's own client and the
 * database's rules decide what they see, exactly as the mockup library and the design library are
 * read. Nothing here writes: the seed is the one writer of the library, and the two SECURITY
 * DEFINER functions of the migration are the only writers of a job.
 *
 * A row that cannot be read is **left out and counted**, never shown half-made.
 */

/** Bounded well above what `07` and F-L1 ask for, so a stray row cannot hide one. */
const LIBRARY_LIMIT = 200;
const JOBS_LIMIT = 50;

const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

export interface ShootLibrary {
  readonly concepts: readonly ShootConcept[];
  readonly poses: readonly ShootPose[];
  readonly presets: readonly ModelPreset[];
  /** How many rows could not be read, so a screen can say so rather than look complete. */
  readonly unreadable: number;
}

async function read(client: SupabaseClient, table: string, columns: string, order: string): Promise<readonly unknown[]> {
  const { data, error } = await client.from(table).select(columns).order(order).limit(LIBRARY_LIMIT);
  if (error) throw unreadable(error);
  return Array.isArray(data) ? data : [];
}

function parsed<T>(rows: readonly unknown[], of: (row: unknown) => T | null): Readonly<{ kept: readonly T[]; skipped: number }> {
  const kept: T[] = [];
  let skipped = 0;
  for (const row of rows) {
    const one = of(row);
    if (one === null) skipped += 1;
    else kept.push(one);
  }
  return { kept, skipped };
}

/** The whole library in one read each: the ideas, the pose and camera presets, and the people. */
export async function loadShootLibrary(client: SupabaseClient): Promise<ShootLibrary> {
  const [conceptRows, poseRows, presetRows] = await Promise.all([
    read(client, "shoot_concepts", CONCEPT_COLUMNS, "sort"),
    read(client, "shoot_poses", POSE_COLUMNS, "sort"),
    read(client, "model_presets", PRESET_COLUMNS, "sort"),
  ]);
  const concepts = parsed(conceptRows, conceptFromRow);
  const poses = parsed(poseRows, poseFromRow);
  const presets = parsed(presetRows, presetFromRow);
  return {
    concepts: concepts.kept,
    poses: poses.kept,
    presets: presets.kept,
    unreadable: concepts.skipped + poses.skipped + presets.skipped,
  };
}

/** The runs of one AI image board, newest first, so a panel can show the last result and its cost. */
export async function loadShootJobs(client: SupabaseClient, boardId: string): Promise<readonly ShootJobRow[]> {
  const { data, error } = await client.from("shoot_jobs").select(JOB_COLUMNS).eq("board_id", boardId).order("created_at", { ascending: false }).limit(JOBS_LIMIT);
  if (error) throw unreadable(error);
  const rows = z.array(jobRow).safeParse(data ?? []);
  if (!rows.success) throw unreadable(rows.error);
  return rows.data;
}

/** The newest run of a board, or null for a board nobody has run yet. */
export async function loadLatestShootJob(client: SupabaseClient, boardId: string): Promise<ShootJobRow | null> {
  const jobs = await loadShootJobs(client, boardId);
  return jobs[0] ?? null;
}
