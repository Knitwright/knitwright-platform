import type { ImportView } from "@/lib/design-import/view-model";
import type { ViewLandmarks } from "@/lib/design-import/types";

/** The browser's calls to the design import routes. Answers are checked by hand: the browser ships no schema library. */

const UNREACHABLE = "We could not reach the server. Check your connection and try again.";
const ODD_ANSWER = "The server gave an answer we could not read. Nothing was changed.";

export type Answer<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly message: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** The server's envelope: `{ success: true, data }` or `{ success: false, error: { message } }`. */
export function unwrap(body: unknown): Answer<unknown> {
  if (!isRecord(body)) return { ok: false, message: ODD_ANSWER };
  if (body.success === true) return { ok: true, data: body.data };
  const message = isRecord(body.error) && typeof body.error.message === "string" ? body.error.message : ODD_ANSWER;
  return { ok: false, message };
}

export type Reading = Answer<ImportView>;

/** A reading, or the reason there is none. */
export function readingFrom(body: unknown): Reading {
  const outer = unwrap(body);
  if (!outer.ok) return outer;
  if (!isRecord(outer.data)) return { ok: false, message: ODD_ANSWER };
  if (outer.data.kind === "rejection" && typeof outer.data.reason === "string") return { ok: false, message: outer.data.reason };
  if (outer.data.kind === "ready" && isRecord(outer.data.view) && typeof outer.data.view.id === "string") return { ok: true, data: outer.data.view as unknown as ImportView };
  return { ok: false, message: ODD_ANSWER };
}

async function send(url: string, body: unknown): Promise<unknown> {
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return await response.json().catch(() => null);
  } catch {
    return { success: false, error: { message: UNREACHABLE } };
  }
}

export async function uploadPicture(file: File): Promise<Answer<string>> {
  const form = new FormData();
  form.set("kind", "photo");
  form.set("file", file);
  try {
    const outer = unwrap(await (await fetch("/api/files", { method: "POST", body: form })).json().catch(() => null));
    if (!outer.ok) return outer;
    return isRecord(outer.data) && typeof outer.data.id === "string" ? { ok: true, data: outer.data.id } : { ok: false, message: ODD_ANSWER };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

export const readPicture = async (fileId: string): Promise<Reading> => readingFrom(await send("/api/design-import", { fileId, rights: true }));
export const refit = async (importId: string, edits: ViewLandmarks): Promise<Reading> => readingFrom(await send(`/api/design-import/${importId}/refit`, { edits }));

export const replaceLayer = async (importId: string, layerId: string, artworkId: string): Promise<Reading> => readingFrom(await send(`/api/design-import/${importId}/replace`, { layerId, artworkId }));

export interface Accepted {
  readonly layerIds: readonly string[];
  readonly needsOwnFile: readonly string[];
}

export async function accept(importId: string, layerIds: "all" | readonly string[]): Promise<Answer<Accepted>> {
  const outer = unwrap(await send(`/api/design-import/${importId}/accept`, { layerIds }));
  if (!outer.ok) return outer;
  const data = outer.data;
  if (isRecord(data) && Array.isArray(data.layerIds) && Array.isArray(data.needsOwnFile)) return { ok: true, data: { layerIds: data.layerIds.map(String), needsOwnFile: data.needsOwnFile.map(String) } };
  return { ok: false, message: ODD_ANSWER };
}

export async function discard(importId: string): Promise<Answer<true>> {
  const outer = unwrap(await send(`/api/design-import/${importId}/discard`, {}));
  return outer.ok ? { ok: true, data: true } : outer;
}
