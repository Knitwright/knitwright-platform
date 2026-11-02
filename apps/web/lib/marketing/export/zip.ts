import { zipSync, type Zippable } from "fflate";
import { FORMAT_LABELS, type FileFormat } from "./targets";

/**
 * SEVERAL ARTBOARDS AS ONE ZIP (spec F-L2: "Multiple boards export as a **zip**"; plan v5 L4,
 * decision 0094).
 *
 * `fflate` is what the platform already zips with (`lib/print/build/package.ts`,
 * `lib/job-packet/zip.ts`), under MIT. One folder per format, as the flow export does, so a person
 * who asked for PNGs and PDFs can find each set; a zip of one format has one folder, which is
 * still clearer than a pile of files.
 *
 * No clock: `zipSync` is given a fixed date, so the same artboards give the same zip.
 */

export interface ExportedFile {
  readonly name: string;
  readonly format: FileFormat;
  readonly bytes: Uint8Array;
}

/** The folder a format's files go in: the format's own name, lower case. */
export const folderOf = (format: FileFormat): string => FORMAT_LABELS[format].toLowerCase();

/** Fixed, so the same files give the same zip. The platform's other zips do the same. */
const FIXED_DATE = new Date(Date.UTC(2000, 0, 1));

/** The files as one zip, a folder per format. A name used twice in a folder is numbered. */
export function zipExports(files: readonly ExportedFile[]): Uint8Array {
  const tree: Record<string, Record<string, Uint8Array>> = {};
  for (const file of files) {
    const folder = (tree[folderOf(file.format)] ??= {});
    folder[freeName(folder, file.name)] = file.bytes;
  }
  return zipSync(tree as Zippable, { level: 6, mtime: FIXED_DATE });
}

/** A name nothing in the folder already holds. */
function freeName(folder: Readonly<Record<string, Uint8Array>>, name: string): string {
  if (!(name in folder)) return name;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = name.replace(/\.([a-z]+)$/, `-${n}.$1`);
    if (!(candidate in folder)) return candidate;
  }
  throw new Error("Too many files of the same name in one export.");
}

/** What the zip is called when it is sent. No date in it, so the same export is the same name. */
export const zipName = (projectName: string): string => {
  const safe = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, "");
  return `${safe === "" ? "launch" : safe}-exports.zip`;
};
