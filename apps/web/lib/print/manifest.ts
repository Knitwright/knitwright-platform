import type { PrintFormat } from "./formats";
import { DRAFT_PATTERN_SENTENCE } from "./layout/notes";
import { scaleNote } from "./layout/notes";
import type { BuildEnv } from "./layout/context";
import type { PlayerTag } from "./layout/scene";
import type { ViewId } from "@/lib/artwork-stack";

export interface FileEntry {
  readonly path: string;
  readonly kind: "piece" | "player" | "transfer";
  readonly pieceId: string;
  readonly view: ViewId;
  readonly size: string;
  readonly sizeLabel: string | null;
  readonly player: PlayerTag | null;
  readonly playerIndex: number | null;
  readonly format: PrintFormat;
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly pageWidthMm: number;
  readonly pageHeightMm: number;
  readonly lowestDpi: number | null;
  readonly flattened: boolean;
  readonly warnings: readonly string[];
}

/** One line of the manifest: everything about a file except its bytes. */
export type ManifestLine = Omit<FileEntry, "bytes"> & { readonly byteLength: number };

export const manifestLines = (files: readonly FileEntry[]): ManifestLine[] =>
  files.map(({ bytes, ...rest }) => ({ ...rest, byteLength: bytes.length }));

const CSV_COLUMNS = ["file", "kind", "piece", "size", "size label", "player number", "player name", "format", "page width mm", "page height mm", "lowest dpi", "pixels", "bytes", "sha256", "warnings"] as const;

const quote = (value: string | number): string => {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** The manifest as a CSV a print house can open: one line per file, in the order the files are in. */
export function manifestCsv(lines: readonly ManifestLine[]): string {
  const rows = lines.map((l) =>
    [l.path, l.kind, l.pieceId, l.size, l.sizeLabel ?? "", l.player?.number ?? "", l.player?.name ?? "", l.format, l.pageWidthMm, l.pageHeightMm, l.lowestDpi === null ? "" : Math.round(l.lowestDpi), l.flattened ? "pixels" : "vector", l.byteLength, l.sha256, l.warnings.join(" | ")].map(quote).join(","),
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}

export function manifestJson(lines: readonly ManifestLine[], context: Record<string, unknown>): string {
  return JSON.stringify({ ...context, files: lines }, null, 2) + "\n";
}

export interface ReadmeInfo {
  readonly env: BuildEnv;
  readonly designName: string;
  readonly fileCount: number;
  readonly playerCount: number;
  readonly problems: readonly string[];
  readonly formats: readonly PrintFormat[];
}

/** A plain-English note for whoever opens the zip. It states the settings the files were built with, and what is still a draft. */
export function readmeText(info: ReadmeInfo): string {
  const { env } = info;
  const source = env.settings.source === "print-house" ? "from your print house" : "Knitwright default, not from your print house";
  const lines = [
    `Print files for ${info.designName}`,
    "",
    `${info.fileCount} files in ${info.formats.map((f) => f.toUpperCase()).join(", ")}${info.playerCount > 0 ? `, with a set for each of ${info.playerCount} players` : ""}.`,
    "Each file is one piece at 1:1: the page is the piece plus its bleed. The black line is the cut line and the blue dashed line is the bleed line.",
    "",
    "Settings these files were built with",
    `- Bleed: ${env.settings.bleedMm} mm (${source}).`,
    `- Resolution: ${env.settings.dpi} dpi for pictures and TIFF files (${source}).`,
    `- ${scaleNote(env)}`,
    `- ${env.settings.iccBytes === null ? "No print house colour profile set: colours are sRGB." : `Colour profile: ${env.settings.iccName ?? "from your print house"}.`}`,
    ...(env.patternReviewed ? [] : ["", DRAFT_PATTERN_SENTENCE + " A technician has not reviewed the pattern pieces these files are cut to."]),
    ...(info.problems.length === 0 ? [] : ["", "Not made", ...info.problems.map((p) => `- ${p}`)]),
    "",
    "manifest.csv lists every file with its size, player, page size and a SHA-256 you can use to check a file arrived whole.",
    "",
  ];
  return lines.join("\r\n");
}
