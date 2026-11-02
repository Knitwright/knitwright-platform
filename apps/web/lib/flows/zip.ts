import { zipSync, type Zippable } from "fflate";
import { FLOW_FORMATS, type FlowFormat } from "./types";

/**
 * "Export all" (spec F-L4): a zip with a folder per format.
 *
 * It carries no clock and sorts every entry, so the same outputs always give the same bytes -- the
 * house rule the job packet already follows (`lib/job-packet/zip.ts`, decision 0043), and the reason
 * a test can check a zip at all.
 *
 * The zip also holds `contents.txt`, which names every file, the board it came from and the label
 * the spec puts on anything a model made. A zip of pictures with no provenance in it is how an
 * AI-made scene ends up somewhere it was never allowed, so the labels travel with the files.
 */

const FIXED_TIME = new Date(Date.UTC(2020, 0, 1));
const text = (value: string): Uint8Array => new TextEncoder().encode(value);

/** Keeps a name inside its folder: no slash, no "..", nothing but plain characters. */
export const safeName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/-+/g, "-")
    .replace(/-$/, "") || "asset";

export interface ExportEntry {
  readonly boardId: string;
  /** The board's own name, which becomes the file's name. */
  readonly name: string;
  readonly format: FlowFormat;
  readonly bytes: Uint8Array;
  /** "AI-generated", or null for a picture the platform drew. Written into contents.txt. */
  readonly label: string | null;
}

export interface ExportFile {
  readonly boardId: string;
  /** Where it sits in the zip: `<format>/<name>.<format>`. */
  readonly path: string;
  readonly label: string | null;
}

/**
 * Where each output goes in the zip. One folder per format, and a name used twice gets a number, so
 * two boards called "Front render" do not become one file.
 */
export function exportPaths(entries: readonly ExportEntry[]): readonly ExportFile[] {
  const taken = new Map<string, number>();
  return [...entries]
    .sort((a, b) => FLOW_FORMATS.indexOf(a.format) - FLOW_FORMATS.indexOf(b.format) || a.name.localeCompare(b.name) || a.boardId.localeCompare(b.boardId))
    .map((entry) => {
      const base = `${entry.format}/${safeName(entry.name)}`;
      const seen = taken.get(base) ?? 0;
      taken.set(base, seen + 1);
      const suffix = seen === 0 ? "" : `-${seen + 1}`;
      return { boardId: entry.boardId, path: `${base}${suffix}.${entry.format}`, label: entry.label };
    });
}

/** The list inside the zip: every file, the board it came from, and its label where it has one. */
export function contentsText(entries: readonly ExportEntry[], files: readonly ExportFile[]): string {
  const byBoard = new Map(entries.map((entry) => [entry.boardId, entry]));
  const lines = [
    "Knitwright launch pack: every output of one flow run, in a folder per format.",
    "A file marked AI-generated holds a scene a model made. The garment in it is the one the platform drew.",
    "An AI-made picture is never artwork: it does not go on a panel and it is not part of a print file.",
    "",
  ];
  for (const file of files) {
    const entry = byBoard.get(file.boardId);
    lines.push(`${file.path}\t${entry?.name ?? file.boardId}${file.label ? `\t${file.label}` : ""}`);
  }
  lines.push("");
  return lines.join("\r\n");
}

/** The zip itself: a folder per format, plus contents.txt. The same outputs give the same bytes. */
export function flowZip(entries: readonly ExportEntry[]): Uint8Array {
  const files = exportPaths(entries);
  const byBoard = new Map(entries.map((entry) => [entry.boardId, entry]));
  const tree: Zippable = { "contents.txt": [text(contentsText(entries, files)), { level: 6, mtime: FIXED_TIME }] };
  for (const file of files) {
    const entry = byBoard.get(file.boardId);
    if (!entry) continue;
    // Pictures and clips are already compressed, so storing them again only costs time.
    tree[file.path] = [entry.bytes, { level: 0, mtime: FIXED_TIME }];
  }
  return zipSync(tree);
}

/** The folders a zip of these outputs would hold, for the panel to show before it is made. */
export const foldersOf = (entries: readonly ExportEntry[]): readonly string[] => [
  ...new Set(exportPaths(entries).map((file) => file.path.split("/")[0] as string)),
];
