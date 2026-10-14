import type { ArtworkDetail, ChangeResult } from "./service";
import type { ArtworkRecord } from "./records";
import type { SeamReport } from "./tile";

/** What the artwork screens do with the routes. The fetcher is passed in so the code can be tested without a browser. */

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type Outcome<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; reason: string }>;

const GENERIC = "Something went wrong. Try again.";

const call = async <T>(fetcher: Fetcher, input: string, init?: RequestInit): Promise<Outcome<T>> => {
  try {
    const response = await fetcher(input, init);
    const body = (await response.json()) as { success?: boolean; data?: T; error?: { message?: string } };
    if (body.success === true && body.data !== undefined) return { ok: true, data: body.data };
    return { ok: false, reason: body.error?.message ?? GENERIC };
  } catch {
    return { ok: false, reason: GENERIC };
  }
};

export type UploadedArtwork = ArtworkRecord & Readonly<{ whiteBackground: boolean }>;

export const uploadArtwork = (fetcher: Fetcher, file: File, rightsConfirmed: boolean): Promise<Outcome<UploadedArtwork>> => {
  const form = new FormData();
  form.set("file", file);
  if (rightsConfirmed) form.set("rights", "yes");
  return call(fetcher, "/api/artwork", { method: "POST", body: form });
};

export const listArtwork = (fetcher: Fetcher): Promise<Outcome<{ artworks: ArtworkRecord[] }>> => call(fetcher, "/api/artwork");

export const artworkDetail = (fetcher: Fetcher, id: string, widthMm?: number): Promise<Outcome<ArtworkDetail>> =>
  call(fetcher, `/api/artwork/${id}${widthMm === undefined ? "" : `?widthMm=${encodeURIComponent(widthMm)}`}`);

export const deleteArtwork = (fetcher: Fetcher, id: string): Promise<Outcome<{ deleted: true }>> =>
  call(fetcher, `/api/artwork/${id}`, { method: "DELETE" });

export const tileReport = (fetcher: Fetcher, id: string): Promise<Outcome<SeamReport>> => call(fetcher, `/api/artwork/${id}/tile`);

export const changeArtwork = (
  fetcher: Fetcher,
  id: string,
  change: { action: "remove-white-background" } | { action: "make-seamless"; method: "blend" | "mirror" },
  accept: boolean,
): Promise<Outcome<ChangeResult>> =>
  call(fetcher, `/api/artwork/${id}/change`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ change, accept }),
  });

/** A short-lived link to a stored file, for showing the screen copy. */
export const screenLink = async (fetcher: Fetcher, fileId: string): Promise<Outcome<string>> => {
  const link = await call<{ url: string }>(fetcher, `/api/files/${fileId}/link`);
  return link.ok ? { ok: true, data: link.data.url } : link;
};
