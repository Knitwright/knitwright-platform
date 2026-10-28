import { readJson } from "@/lib/http/read-json";
import { z } from "zod";
import type { ExportFormat } from "@/lib/techpack/exports/formats";

/**
 * The download buttons of the tech pack page, kept apart from the screen: which address each one
 * calls, the name a file is saved under, what a failure says, and the busy state. The component
 * holds markup and wiring only. Nothing here imports the code that makes the files.
 */

export type ControlId = "pdf" | "xlsx" | "svg-front" | "svg-back";

export interface DownloadControl {
  readonly id: ControlId;
  readonly label: string;
  readonly format: ExportFormat;
  /** Which drawing, for an SVG. */
  readonly view: "front" | "back" | null;
  readonly accessibleName: string;
  /** What is being prepared, in words, for the announcement. */
  readonly noun: string;
  /** The name of a file that came with none. */
  readonly fallbackName: string;
}

export const DOWNLOAD_CONTROLS: readonly DownloadControl[] = [
  { id: "pdf", label: "PDF", format: "pdf", view: null, accessibleName: "Download PDF", noun: "PDF", fallbackName: "tech-pack.pdf" },
  {
    id: "xlsx",
    label: "Excel",
    format: "xlsx",
    view: null,
    accessibleName: "Download Excel",
    noun: "Excel file",
    fallbackName: "tech-pack.xlsx",
  },
  {
    id: "svg-front",
    label: "SVG front",
    format: "svg",
    view: "front",
    accessibleName: "Download SVG front",
    noun: "front drawing",
    fallbackName: "tech-pack-front.svg",
  },
  {
    id: "svg-back",
    label: "SVG back",
    format: "svg",
    view: "back",
    accessibleName: "Download SVG back",
    noun: "back drawing",
    fallbackName: "tech-pack-back.svg",
  },
];

export interface AddressOptions {
  /** The version the page shows, so the file is that version. */
  readonly version: number;
  /** The colourway of the page, when the address names one. */
  readonly colourwayId?: string | undefined;
}

/** The address of the export route for one control. */
export function downloadAddress(projectId: string, control: DownloadControl, options: AddressOptions): string {
  const query = [
    ...(control.view === null ? [] : [`view=${control.view}`]),
    `version=${options.version}`,
    ...(options.colourwayId === undefined ? [] : [`colourway=${encodeURIComponent(options.colourwayId)}`]),
  ];
  return `/api/projects/${encodeURIComponent(projectId)}/exports/${control.format}?${query.join("&")}`;
}

const MAX_NAME = 120;
/** Control characters and marks that change the direction of text. */
const HIDDEN = /[\p{Cc}\p{Cf}]/gu;
const SEPARATORS = /[/\\:*?"<>|]/g;

/** A name that is safe to save under: no path, no hidden characters, not empty and not only dots. */
function cleanName(text: string, fallback: string): string {
  const name = text.replace(HIDDEN, "").replace(SEPARATORS, "-").replace(/^[.\s]+/, "").trim().slice(0, MAX_NAME).trim();
  return name === "" ? fallback : name;
}

const decoded = (text: string): string | null => {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
};

/** The file name in a content-disposition header: the UTF-8 form first, then the plain one, then the fallback. */
export function fileNameFromDisposition(header: string | null, fallback: string): string {
  if (header === null) return fallback;
  const utf8 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)?.[1];
  const fromUtf8 = utf8 === undefined ? null : decoded(utf8.trim());
  if (fromUtf8 !== null) return cleanName(fromUtf8, fallback);
  const plain = /filename\s*=\s*"([^"]*)"/i.exec(header)?.[1] ?? /filename\s*=\s*([^;\s]+)/i.exec(header)?.[1];
  return plain === undefined ? fallback : cleanName(plain, fallback);
}

const SESSION_ENDED = "Your session has ended. Sign in again to download this file.";
const NOT_FOUND = "This design could not be found.";
const TOO_MANY = "Too many downloads. Wait a moment and try again.";
const NOT_BUILT = "The file could not be built. Try again in a moment.";
const NOT_WORKING = "The download did not work. Reload the page and try again.";
const UNREACHABLE = "We could not reach the server. Check your connection and try again.";

const envelope = z.object({ success: z.literal(false), error: z.object({ code: z.string(), message: z.string().min(1).max(300) }) });

/**
 * A plain sentence for a failed answer. The server's own words are used only for "not found", where
 * they say which thing was missing. Nothing else the server said is shown, so nothing internal is.
 */
export function failureSentence(status: number, body: unknown): string {
  if (status === 401 || status === 403) return SESSION_ENDED;
  if (status === 429) return TOO_MANY;
  if (status >= 500) return NOT_BUILT;
  if (status === 404) {
    const parsed = envelope.safeParse(body);
    return parsed.success && parsed.data.error.code === "not_found" ? parsed.data.error.message : NOT_FOUND;
  }
  return NOT_WORKING;
}

export type Busy = ControlId | null;

export const isBusyWith = (busy: Busy, id: ControlId): boolean => busy === id;

/** One download runs at a time: a second press while one is running changes nothing. */
export const startDownload = (busy: Busy, id: ControlId): Busy => busy ?? id;

/** Only the download that was running ends the busy state. */
export const finishDownload = (busy: Busy, id: ControlId): Busy => (busy === id ? null : busy);

/** What a screen reader is told while a file is being made. Empty when nothing is. */
export function busyAnnouncement(busy: Busy): string {
  const control = DOWNLOAD_CONTROLS.find((entry) => entry.id === busy);
  return control ? `Preparing the ${control.noun}. This can take a few seconds.` : "";
}

export type DownloadResult =
  | Readonly<{ ok: true; name: string; blob: Blob }>
  | Readonly<{ ok: false; sentence: string }>;

const TYPE_PREFIX: Readonly<Record<ExportFormat, string>> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  svg: "image/svg+xml",
};

/**
 * Asks the route for a file. `fetcher` sends the request, so the browser's `fetch` is not needed
 * here. A page that came back in place of the file, such as a sign-in page, is not saved.
 */
export async function downloadFile(
  projectId: string,
  control: DownloadControl,
  options: AddressOptions,
  fetcher: (address: string) => Promise<Response>,
): Promise<DownloadResult> {
  let response: Response;
  try {
    response = await fetcher(downloadAddress(projectId, control, options));
  } catch {
    return { ok: false, sentence: UNREACHABLE };
  }
  if (!response.ok) return { ok: false, sentence: failureSentence(response.status, await readJson(response)) };
  if (!(response.headers.get("content-type") ?? "").startsWith(TYPE_PREFIX[control.format])) return { ok: false, sentence: NOT_WORKING };
  const blob = await response.blob();
  return { ok: true, name: fileNameFromDisposition(response.headers.get("content-disposition"), control.fallbackName), blob };
}
