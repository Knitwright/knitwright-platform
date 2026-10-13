import { z } from "zod";
import type { PatternJobView } from "./job-view";

/**
 * The pattern section's calls, kept apart from the screen so they can be tested: ask for a
 * pattern, read the newest one, and get a short-lived link to one of its files.
 */

export const UNREACHABLE = "We could not reach the server. Check your connection and try again.";
const FAILED = "The pattern could not be asked for. Try again.";

/** How often the section asks how a pattern is going. Drafting takes from seconds to minutes. */
export const PATTERN_POLL_MS = 5000;

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const viewSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  size: z.string(),
  status: z.enum(["waiting", "drafting", "ready", "failed"]),
  draft: z.string().nullable(),
  pieces: z.number().int().nullable(),
  notes: z.array(z.string()),
  dxfFileId: z.uuid().nullable(),
  previewFileId: z.uuid().nullable(),
  message: z.string().nullable(),
});

const failure = z.object({ success: z.literal(false), error: z.object({ message: z.string() }) });
const asked = z.union([z.object({ success: z.literal(true), data: viewSchema }), failure]);
const latest = z.object({
  success: z.literal(true),
  data: z.object({ available: z.boolean(), job: viewSchema.nullable() }),
});
const link = z.object({ success: z.literal(true), data: z.object({ url: z.string() }) });

export type AskResult = Readonly<{ ok: true; job: PatternJobView }> | Readonly<{ ok: false; reason: string }>;

export async function askForPattern(projectId: string, size: string, fetcher: Fetch = fetch): Promise<AskResult> {
  try {
    const response = await fetcher(`/api/projects/${projectId}/patterns`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ size }),
    });
    const parsed = asked.safeParse(await response.json().catch(() => null));
    if (!parsed.success) return { ok: false, reason: FAILED };
    return parsed.data.success ? { ok: true, job: parsed.data.data } : { ok: false, reason: parsed.data.error.message };
  } catch {
    return { ok: false, reason: UNREACHABLE };
  }
}

export type Latest = Readonly<{ available: boolean; job: PatternJobView | null }>;

/** The newest pattern, or null when the server could not be asked; the section asks again. */
export async function readLatestPattern(projectId: string, fetcher: Fetch = fetch): Promise<Latest | null> {
  try {
    const response = await fetcher(`/api/projects/${projectId}/patterns`, { cache: "no-store" });
    const parsed = latest.safeParse(await response.json().catch(() => null));
    return parsed.success ? parsed.data.data : null;
  } catch {
    return null;
  }
}

/** A link to one stored file that works for about a minute, or null. */
export async function fileLink(fileId: string, fetcher: Fetch = fetch): Promise<string | null> {
  try {
    const response = await fetcher(`/api/files/${fileId}/link`, { cache: "no-store" });
    const parsed = link.safeParse(await response.json().catch(() => null));
    return parsed.success ? parsed.data.data.url : null;
  } catch {
    return null;
  }
}
