import { unzipSync, zipSync, type Zippable } from "fflate";
import type { PatternFile } from "./patterns";

/**
 * The one ZIP a factory downloads: the job sheet, the batch's print files exactly as the ops console builds
 * them (decision 0043, with their manifest), and the patterns from the pattern source. It carries no clock, so
 * the same inputs give the same bytes.
 */

const FIXED_TIME = new Date(Date.UTC(2020, 0, 1));
const text = (value: string): Uint8Array => new TextEncoder().encode(value);

/** Keeps a path inside its folder: no leading slash, no "..", nothing but plain characters. */
const safePath = (path: string): string =>
  path
    .split("/")
    .map((part) => part.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "_"))
    .filter((part) => part.length > 0)
    .join("/") || "file";

export function readme(patternNote: string | null): string {
  return [
    "Knitwright job packet: everything for one batch.",
    "job_sheet.pdf: the orders, sizes, names and numbers, materials, packing and the due date.",
    "print/: the print files, one folder per order, with manifest.csv. Do not print a line the manifest says differs from the release; ask Knitwright.",
    patternNote ?? "patterns/: the pattern files for each order and size.",
    "",
  ].join("\r\n");
}

export interface JobZipInput {
  readonly sheet: Uint8Array;
  /** The batch's print files ZIP from lib/ops/factory-sheet/print-zip.ts. */
  readonly printZip: Uint8Array;
  readonly patterns: readonly PatternFile[];
  readonly patternNote: string | null;
}

export function jobZip(input: JobZipInput): Uint8Array {
  const tree: Zippable = {
    "README.txt": [text(readme(input.patternNote)), { level: 6, mtime: FIXED_TIME }],
    "job_sheet.pdf": [input.sheet, { level: 0, mtime: FIXED_TIME }],
  };
  const printed = unzipSync(input.printZip);
  for (const name of Object.keys(printed).sort()) tree[`print/${safePath(name)}`] = [printed[name]!, { level: 6, mtime: FIXED_TIME }];
  for (const file of [...input.patterns].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    tree[`patterns/${safePath(file.path)}`] = [file.bytes, { level: 6, mtime: FIXED_TIME }];
  }
  return zipSync(tree);
}
