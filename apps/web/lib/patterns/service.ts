import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { storePatternFiles } from "@/lib/storage/store";
import { PATTERN_JOB_COLUMNS, PATTERN_STALE_MESSAGE, isPatternStale, type PatternJobRow } from "./job-view";
import type { PatternRequest } from "./request";

/**
 * Pattern jobs in the database. Reads for a person go through their own client, so the
 * database's rules decide what they see. Every write goes through the server's client.
 */

export type PatternProvider = "claude-bridge" | "fashioninsta";

const rowSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  size_label: z.string(),
  draft: z.string().nullable(),
  pieces: z.number().int().nullable(),
  notes: z.array(z.string()),
  dxf_file_id: z.uuid().nullable(),
  preview_file_id: z.uuid().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
});

const failIf = (error: { message: string } | null, what: string): void => {
  if (error) throw new Error(what, { cause: error });
};

export type NewPatternJob = Readonly<{
  brandId: string;
  projectId: string;
  version: number;
  userId: string;
  provider: PatternProvider;
  request: PatternRequest;
}>;

export async function createPatternJob(admin: SupabaseClient, job: NewPatternJob): Promise<string> {
  const { data, error } = await admin
    .from("pattern_jobs")
    .insert({
      brand_id: job.brandId,
      project_id: job.projectId,
      version: job.version,
      provider: job.provider,
      request: job.request,
      size_label: job.request.size,
      created_by: job.userId,
    })
    .select("id")
    .single();
  failIf(error, "The pattern request could not be recorded.");
  return z.object({ id: z.uuid() }).parse(data).id;
}

/** The newest pattern job of a design, or null when none was asked for. */
export async function latestPatternJob(client: SupabaseClient, brandId: string, projectId: string): Promise<PatternJobRow | null> {
  const { data, error } = await client
    .from("pattern_jobs")
    .select(PATTERN_JOB_COLUMNS)
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);
  failIf(error, "The pattern could not be read.");
  const first = (data ?? [])[0];
  return first ? rowSchema.parse(first) : null;
}

/**
 * Moves a job on only from the state it should be in, so a job already given up is never
 * marked done afterwards. Returns whether it moved.
 */
async function move(admin: SupabaseClient, jobId: string, from: readonly string[], change: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await admin
    .from("pattern_jobs")
    .update({ ...change, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .in("status", [...from])
    .select("id");
  failIf(error, "The pattern job could not be updated.");
  return (data ?? []).length === 1;
}

/** Gives up a job left unfinished too long. */
export async function expirePatternJob(admin: SupabaseClient, row: PatternJobRow, now: Date): Promise<void> {
  if (!isPatternStale(row, now)) return;
  await move(admin, row.id, ["queued", "running"], { status: "failed", error: PATTERN_STALE_MESSAGE, finished_at: now.toISOString() });
}

// ---------------------------------------------------------------------------------------
// The bridge: whatever drafts patterns outside the app reads open jobs and finishes them.
// ---------------------------------------------------------------------------------------

const openSchema = z.object({
  id: z.uuid(),
  brand_id: z.uuid(),
  project_id: z.uuid(),
  version: z.number().int(),
  status: z.enum(["queued", "running"]),
  request: z.record(z.string(), z.unknown()),
  size_label: z.string(),
  created_by: z.uuid(),
  created_at: z.string(),
});
export type OpenPatternJob = z.output<typeof openSchema>;

/** The jobs waiting for a pattern, oldest first. */
export async function openPatternJobs(admin: SupabaseClient, provider: PatternProvider): Promise<OpenPatternJob[]> {
  const { data, error } = await admin
    .from("pattern_jobs")
    .select("id, brand_id, project_id, version, status, request, size_label, created_by, created_at")
    .eq("provider", provider)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(20);
  failIf(error, "The open pattern jobs could not be read.");
  return z.array(openSchema).parse(data ?? []);
}

async function openJob(admin: SupabaseClient, jobId: string): Promise<OpenPatternJob> {
  const { data, error } = await admin
    .from("pattern_jobs")
    .select("id, brand_id, project_id, version, status, request, size_label, created_by, created_at")
    .eq("id", jobId)
    .in("status", ["queued", "running"])
    .maybeSingle();
  failIf(error, "The pattern job could not be read.");
  if (!data) throw new Error(`No open pattern job ${jobId}.`);
  return openSchema.parse(data);
}

export async function markPatternRunning(admin: SupabaseClient, jobId: string): Promise<boolean> {
  return move(admin, jobId, ["queued"], { status: "running" });
}

export type PatternResult = Readonly<{
  dxf: Uint8Array;
  preview: Uint8Array | null;
  draft: string;
  pieces: number | null;
  notes: readonly string[];
}>;

const MAX_NOTES = 40;
const MAX_NOTE_LENGTH = 500;

/** Stores the files and marks the job done. Files of a job that cannot be finished are left for the quota cleanup. */
export async function completePatternJob(admin: SupabaseClient, jobId: string, result: PatternResult): Promise<void> {
  const job = await openJob(admin, jobId);
  const files = await storePatternFiles({
    admin,
    brandId: job.brand_id,
    userId: job.created_by,
    dxf: result.dxf,
    preview: result.preview,
  });
  const moved = await move(admin, jobId, ["queued", "running"], {
    status: "succeeded",
    draft: result.draft.slice(0, 120),
    pieces: result.pieces,
    notes: result.notes.slice(0, MAX_NOTES).map((note) => note.slice(0, MAX_NOTE_LENGTH)),
    dxf_file_id: files.dxf,
    preview_file_id: files.preview,
    finished_at: new Date().toISOString(),
  });
  if (!moved) throw new Error(`Pattern job ${jobId} was finished or given up before it could be completed.`);
}

export async function failPatternJob(admin: SupabaseClient, jobId: string, message: string): Promise<void> {
  const safe = message.trim().slice(0, 300) || "The pattern could not be made.";
  await move(admin, jobId, ["queued", "running"], { status: "failed", error: safe, finished_at: new Date().toISOString() });
}
