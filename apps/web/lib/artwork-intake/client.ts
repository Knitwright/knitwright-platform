import { LOGO_RIGHTS_MISSING } from "@/lib/storage/rights";
import type { DpiCheck } from "./effective-dpi";
import type { ArtworkSummary } from "./records";

/**
 * What the artwork screens say and send, kept apart from the screens so it can be tested. The server checks
 * every file again; the checks here only save a round trip.
 */

export const ARTWORK_ACCEPT = ".png,.jpg,.jpeg,.tif,.tiff,.pdf,.ai,.svg,image/png,image/jpeg,image/tiff,application/pdf,image/svg+xml";
export const UPLOAD_HINT = "A PNG, JPEG, TIFF, PDF or SVG file, up to 50 MB. An Illustrator file must be saved with 'Create PDF compatible file'.";
export const UNREACHABLE = "We could not reach the server. Check your connection and try again.";
export const FAILED = "That did not work. Try again.";

export type Answer<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; message: string }>;

/** The server's answer envelope, as plain data. */
export async function readAnswer<T>(response: Response): Promise<Answer<T>> {
  try {
    const body = (await response.json()) as { success?: boolean; data?: T; error?: { message?: string } };
    if (body.success === true && body.data !== undefined) return { ok: true, data: body.data };
    return { ok: false, message: body.error?.message || FAILED };
  } catch {
    return { ok: false, message: FAILED };
  }
}

type Post = (url: string, init: RequestInit) => Promise<Response>;

const attempt = async <T>(send: () => Promise<Response>): Promise<Answer<T>> => {
  try {
    return await readAnswer<T>(await send());
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
};

export function uploadArtwork(file: File, rightsConfirmed: boolean, post: Post = fetch): Promise<Answer<{ artwork: ArtworkSummary }>> {
  if (!rightsConfirmed) return Promise.resolve({ ok: false, message: LOGO_RIGHTS_MISSING });
  const form = new FormData();
  form.set("file", file);
  form.set("rights", "yes");
  return attempt(() => post("/api/artwork", { method: "POST", body: form }));
}

export const convertArtwork = <T>(id: string, body: Readonly<Record<string, unknown>>, post: Post = fetch): Promise<Answer<T>> =>
  attempt(() => post(`/api/artwork/${id}/convert`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

export const readResolution = (id: string, widthMm: number, get: Post = fetch): Promise<Answer<{ resolution: DpiCheck | null }>> =>
  attempt(() => get(`/api/artwork/${id}?widthMm=${encodeURIComponent(String(widthMm))}`, { method: "GET" }));

export const screenLink = (id: string, get: Post = fetch): Promise<Answer<{ url: string }>> => attempt(() => get(`/api/artwork/${id}/screen`, { method: "GET" }));

export const listArtwork = (get: Post = fetch): Promise<Answer<{ artworks: readonly ArtworkSummary[] }>> => attempt(() => get("/api/artwork", { method: "GET" }));

export const removeArtworkRequest = (id: string, send: Post = fetch): Promise<Answer<{ removed: boolean }>> => attempt(() => send(`/api/artwork/${id}`, { method: "DELETE" }));

const COLOUR_WORDS: Readonly<Record<ArtworkSummary["colourSpace"], string>> = {
  srgb: "Colours are sRGB.",
  cmyk: "Colours were CMYK and were converted to sRGB for printing.",
  grey: "Colours were grey and were converted to sRGB for printing.",
  "adobe-rgb": "Colours were Adobe RGB and were converted to sRGB for printing.",
  "display-p3": "Colours were Display P3 and were converted to sRGB for printing.",
  unknown: "The file had no colour profile, so its colours are treated as sRGB.",
};

const FORMAT_WORDS: Readonly<Record<ArtworkSummary["sourceFormat"], string>> = {
  png: "PNG picture",
  jpeg: "JPEG picture",
  tiff: "TIFF picture",
  pdf: "PDF, kept as a vector drawing",
  svg: "SVG, kept as a vector drawing",
};

/** Plain facts about an artwork, one sentence each. */
export function factsFor(artwork: ArtworkSummary): readonly string[] {
  const facts = [`${FORMAT_WORDS[artwork.sourceFormat]}, ${artwork.widthPx.toLocaleString("en-AU")} x ${artwork.heightPx.toLocaleString("en-AU")} pixels.`];
  if (artwork.kind === "raster") {
    facts.push(COLOUR_WORDS[artwork.colourSpace]);
    if (artwork.colourProfileName) facts.push(`Colour profile: ${artwork.colourProfileName}.`);
    facts.push(artwork.dpiMeta === null ? "The file does not say what resolution it was made at." : `The file says it was made at ${artwork.dpiMeta} dpi.`);
  } else if (artwork.naturalWidthMm !== null) {
    facts.push(`Its own size is ${Math.round(artwork.naturalWidthMm)} mm wide. A drawing can be printed at any size.`);
  }
  return facts;
}

/** What to show next to the width box: the dpi, and the warning when it is too low. */
export function resolutionLines(check: DpiCheck): readonly string[] {
  if (!check.applies) return ["This is a drawing, so it prints sharply at any size."];
  const lines = [`At this width it prints at about ${check.dpi} dpi.`];
  if (check.warning) lines.push(check.warning);
  else if (check.largestWidthMm !== null) lines.push(`It can print up to ${check.largestWidthMm} mm wide and still reach ${check.minDpi} dpi.`);
  lines.push(`Minimum ${check.minDpi} dpi: ${check.minDpiSource}.`);
  return lines;
}
