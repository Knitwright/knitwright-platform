import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { View } from "@/lib/flat/model";
import type { GeneratedImage } from "@/lib/providers";
import { storeImage } from "@/lib/storage/store";
import { JOB_COLUMNS, STALE_MESSAGE, type JobImage, type JobRow } from "./job-view";
import type { JobStore } from "./run-job";

/**
 * Jobs and generated pictures in the database. Plan step 14, task 3. Reads go through the
 * user's own client, so the database's rules decide what they see. Writes go through the
 * server's client: no browser may write a job.
 */

const jobRowSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  front_file_id: z.uuid().nullable(),
  back_file_id: z.uuid().nullable(),
  error: z.string().nullable(),
  usage_event_id: z.uuid().nullable(),
  created_at: z.string(),
});

const failIf = (error: { message: string } | null, what: string): void => {
  if (error) throw new Error(what, { cause: error });
};

export type NewJob = Readonly<{
  brandId: string;
  projectId: string;
  version: number;
  userId: string;
  eventId: string;
}>;

/** Records a queued job and returns its id. */
export async function createJob(admin: SupabaseClient, job: NewJob): Promise<string> {
  const { data, error } = await admin
    .from("jobs")
    .insert({
      brand_id: job.brandId,
      project_id: job.projectId,
      version: job.version,
      kind: "photoreal",
      usage_event_id: job.eventId,
      created_by: job.userId,
    })
    .select("id")
    .single();
  failIf(error, "The job could not be recorded.");
  return z.object({ id: z.uuid() }).parse(data).id;
}

/**
 * Moves a job on only from the state it should be in, so a job already given up as stale
 * is never marked done afterwards.
 */
const move = async (
  admin: SupabaseClient,
  jobId: string,
  from: readonly string[],
  change: Record<string, unknown>,
): Promise<boolean> => {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("jobs")
    .update({ ...change, updated_at: now })
    .eq("id", jobId)
    .in("status", [...from])
    .select("id");
  failIf(error, "The job could not be updated.");
  return (data ?? []).length === 1;
};

export function jobStore(admin: SupabaseClient): JobStore {
  return {
    async markRunning(jobId) {
      if (!(await move(admin, jobId, ["queued"], { status: "running" }))) {
        throw new Error("The job was not waiting to run.");
      }
    },
    async markSucceeded(jobId, files) {
      const done = await move(admin, jobId, ["running"], {
        status: "succeeded",
        front_file_id: files.front,
        back_file_id: files.back,
        finished_at: new Date().toISOString(),
      });
      if (!done) throw new Error("The job had already been stopped.");
    },
    async markFailed(jobId, message) {
      await move(admin, jobId, ["queued", "running"], {
        status: "failed",
        error: message,
        finished_at: new Date().toISOString(),
      });
    },
  };
}

/** Checks and stores a generated picture in the brand's folder of the images bucket. */
export const imageSaver =
  (admin: SupabaseClient, brandId: string, userId: string) =>
  async (_view: View, image: GeneratedImage): Promise<string> =>
    (
      await storeImage({
        admin,
        brandId,
        userId,
        kind: "render",
        bytes: image.bytes,
        statedType: image.contentType,
      })
    ).id;

const storedRowSchema = z.object({ id: z.uuid(), bucket: z.string(), path: z.string() });

/**
 * Removes generated pictures of the brand that a job could not keep: first their objects, then
 * their rows, so a row never points at nothing. Only the brand's own render files are touched.
 */
export const imageRemover =
  (admin: SupabaseClient, brandId: string) =>
  async (fileIds: readonly string[]): Promise<void> => {
    if (fileIds.length === 0) return;
    const { data, error } = await admin
      .from("files")
      .select("id, bucket, path")
      .eq("brand_id", brandId)
      .eq("kind", "render")
      .in("id", [...fileIds]);
    failIf(error, "The pictures could not be found.");
    const rows = z.array(storedRowSchema).parse(data ?? []);
    if (rows.length === 0) return;
    for (const bucket of new Set(rows.map((row) => row.bucket))) {
      const removed = await admin.storage.from(bucket).remove(rows.filter((row) => row.bucket === bucket).map((row) => row.path));
      failIf(removed.error, "The pictures could not be removed.");
    }
    const deleted = await admin.from("files").delete().in("id", rows.map((row) => row.id));
    failIf(deleted.error, "The pictures' records could not be removed.");
  };

/** One job of one design of the brand, or null. */
export async function readJob(
  client: SupabaseClient,
  brandId: string,
  projectId: string,
  jobId: string,
): Promise<JobRow | null> {
  const { data, error } = await client
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .eq("id", jobId)
    .maybeSingle();
  failIf(error, "The job could not be read.");
  return data ? jobRowSchema.parse(data) : null;
}

/**
 * Gives up on a job whose server stopped, and gives its cost back. Safe to call twice:
 * only an unfinished job is changed, and a cost is only ever given back once.
 */
export async function expireJob(
  admin: SupabaseClient,
  row: JobRow,
  refund: (eventId: string) => Promise<boolean>,
): Promise<void> {
  await jobStore(admin).markFailed(row.id, STALE_MESSAGE);
  if (row.usage_event_id) await refund(row.usage_event_id);
}

export interface LatestImages {
  readonly version: number;
  readonly images: readonly JobImage[];
}

/** The pictures of the design's newest finished job, or null when none has finished. */
export async function latestImages(
  client: SupabaseClient,
  brandId: string,
  projectId: string,
): Promise<LatestImages | null> {
  const { data, error } = await client
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  failIf(error, "The images could not be read.");
  if (!data) return null;
  const row = jobRowSchema.parse(data);
  if (!row.front_file_id || !row.back_file_id) return null;
  return {
    version: row.version,
    images: [
      { view: "front", fileId: row.front_file_id },
      { view: "back", fileId: row.back_file_id },
    ],
  };
}
