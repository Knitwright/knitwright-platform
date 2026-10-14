import { zipSync, type Zippable } from "fflate";
import type { BuiltFile } from "./file-builder";
import type { PlanEntry } from "./plan";
import type { PrintFileBuilder } from "@/lib/production/contract";

export interface MadeFile {
  readonly entry: PlanEntry;
  readonly file: Pick<BuiltFile, "bytes" | "sha256" | "pageWidthMm" | "pageHeightMm" | "warnings">;
}

type Maker = PrintFileBuilder & { buildFile(spec: PlanEntry["spec"], options?: { transferOnly?: boolean }): Promise<MadeFile["file"]> };

/** Makes the files one after another, so a request holds one piece's pixels at a time. */
export async function makeFiles(builder: Maker, entries: readonly PlanEntry[]): Promise<MadeFile[]> {
  const made: MadeFile[] = [];
  for (const entry of entries) made.push({ entry, file: await builder.buildFile(entry.spec, { transferOnly: entry.transferOnly }) });
  return made;
}

const FORMULA = /^[=+\-@\t\r]/;

/** A spreadsheet cell: quoted, and a cell that could be read as a formula is made plain text. */
export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = FORMULA.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const MANIFEST_HEADER = ["file", "piece", "size", "player number", "player name", "format", "sha256", "page width mm", "page height mm", "notes"];

/** One line per file, in the order they were made. Notes are joined with " | ". */
export function manifestCsv(files: readonly MadeFile[]): string {
  const rows = files.map(({ entry, file }) => [
    entry.path,
    entry.spec.pieceId,
    entry.spec.size,
    entry.player?.number ?? "",
    entry.player?.name ?? "",
    entry.spec.format,
    file.sha256,
    file.pageWidthMm,
    file.pageHeightMm,
    file.warnings.join(" | "),
  ]);
  return [MANIFEST_HEADER, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const FIXED_TIME = new Date(Date.UTC(2020, 0, 1));

/** The files and their manifest as one zip. The zip carries no clock: the same files give the same zip. */
export function zipFiles(files: readonly MadeFile[], extra: Readonly<Record<string, string>> = {}): Uint8Array {
  const tree: Zippable = {};
  for (const { entry, file } of files) tree[entry.path] = [file.bytes, { level: entry.spec.format === "svg" ? 6 : 0, mtime: FIXED_TIME }];
  tree["manifest.csv"] = [new TextEncoder().encode(manifestCsv(files)), { level: 6, mtime: FIXED_TIME }];
  for (const [name, text] of Object.entries(extra)) tree[name] = [new TextEncoder().encode(text), { level: 6, mtime: FIXED_TIME }];
  return zipSync(tree);
}
