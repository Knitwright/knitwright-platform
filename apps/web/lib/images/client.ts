import { z } from "zod";
import type { JobView } from "./job-view";

/**
 * The photoreal panel's two calls, kept apart from the screen so they can be tested:
 * start images, and ask how a job is going.
 */

export const UNREACHABLE = "We could not reach the server. Check your connection and try again.";
const FAILED = "The images could not be started. Try again.";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type StartResult = Readonly<{ ok: true; jobId: string }> | Readonly<{ ok: false; reason: string }>;

const failure = z.object({ success: z.literal(false), error: z.object({ message: z.string() }) });

const started = z.union([z.object({ success: z.literal(true), data: z.object({ jobId: z.uuid() }) }), failure]);

const jobSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  status: z.enum(["working", "succeeded", "failed"]),
  images: z.array(z.object({ view: z.enum(["front", "back"]), fileId: z.uuid() })),
  message: z.string().nullable(),
});

const polled = z.object({ success: z.literal(true), data: jobSchema });

export async function requestImages(projectId: string, colourway: string | undefined, fetcher: Fetch = fetch): Promise<StartResult> {
  try {
    const response = await fetcher(`/api/projects/${projectId}/images`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(colourway ? { colourway } : {}),
    });
    const parsed = started.safeParse(await response.json().catch(() => null));
    if (!parsed.success) return { ok: false, reason: FAILED };
    return parsed.data.success ? { ok: true, jobId: parsed.data.data.jobId } : { ok: false, reason: parsed.data.error.message };
  } catch {
    return { ok: false, reason: UNREACHABLE };
  }
}

/** The job's state, or null when it could not be asked; the panel then asks again. */
export async function pollImageJob(projectId: string, jobId: string, fetcher: Fetch = fetch): Promise<JobView | null> {
  try {
    const response = await fetcher(`/api/projects/${projectId}/images/${jobId}`, { cache: "no-store" });
    const parsed = polled.safeParse(await response.json().catch(() => null));
    return parsed.success ? parsed.data.data : null;
  } catch {
    return null;
  }
}
