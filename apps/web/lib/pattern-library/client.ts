import { readJson } from "@/lib/http/read-json";
import type { BlockDetail } from "./records";
import type { SlotState } from "./slots";

/**
 * The library screen's calls, kept apart from the screen so they can be tested. They return the
 * server's reason in words when something fails, and never throw. This module does not read
 * the answers with zod: the screen runs in the browser, which should not carry it.
 */

export const UNREACHABLE = "We could not reach the server. Check your connection and try again.";
const ODD = "The server's answer could not be read. Try again.";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
type Answer<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; reason: string }>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

async function answerOf<T>(response: Response, accept: (data: unknown) => data is T): Promise<Answer<T>> {
  const body: unknown = await readJson(response);
  if (!isRecord(body)) return { ok: false, reason: ODD };
  if (body.success === true && accept(body.data)) return { ok: true, data: body.data };
  const error = body.error;
  return { ok: false, reason: isRecord(error) && typeof error.message === "string" ? error.message : ODD };
}

async function call<T>(fetcher: Fetch, url: string, init: RequestInit | undefined, accept: (data: unknown) => data is T): Promise<Answer<T>> {
  try {
    return await answerOf(await fetcher(url, { cache: "no-store", ...init }), accept);
  } catch {
    return { ok: false, reason: UNREACHABLE };
  }
}

export type Library = Readonly<{ open: boolean; slots: readonly SlotState[] }>;

const isLibrary = (data: unknown): data is Library => isRecord(data) && typeof data.open === "boolean" && Array.isArray(data.slots);
const isDetail = (data: unknown): data is BlockDetail => isRecord(data) && isRecord(data.block) && Array.isArray(data.sizes) && Array.isArray(data.reviews);
const hasId = (data: unknown): data is { id: string } => isRecord(data) && typeof data.id === "string";
const isUploaded = (data: unknown): data is { id: string; version: number; sizes: string[]; questions: string[]; warnings: string[]; derived: string[] } =>
  hasId(data) && Array.isArray((data as Record<string, unknown>).sizes);

export const readLibrary = (fetcher: Fetch = fetch) => call(fetcher, "/api/pattern-library", undefined, isLibrary);

export const readBlock = (blockId: string, fetcher: Fetch = fetch) => call(fetcher, `/api/pattern-library/${blockId}`, undefined, isDetail);

export const uploadSet = (form: FormData, fetcher: Fetch = fetch) => call(fetcher, "/api/pattern-library", { method: "POST", body: form }, isUploaded);

export type ReviewForm = Readonly<{ reviewerName: string; reviewerRole: string; note: string; reviewedOn: string }>;

export const sendReview = (blockId: string, review: ReviewForm, fetcher: Fetch = fetch) =>
  call(fetcher, `/api/pattern-library/${blockId}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(review) }, hasId);

/** The address a DXF of one size, or of every size, is downloaded from. */
export const dxfAddress = (blockId: string, size: string | "all"): string => `/api/pattern-library/${blockId}/dxf?size=${encodeURIComponent(size)}`;
