import type { MadeFile } from "@/lib/print/build/package";
import { zipFiles } from "@/lib/print/build/package";
import { plannedFiles } from "@/lib/releases/build";
import type { PrintFileBuilder, PrintFileSpec, RosterRow } from "@/lib/production/contract";

export interface ReleaseFiles {
  /** The Store's order reference. It names the folder. */
  readonly orderRef: string;
  readonly specs: readonly PrintFileSpec[];
  /** The hash of each file frozen with the release, by path. */
  readonly frozen: ReadonlyMap<string, string>;
  readonly roster: readonly RosterRow[] | null;
  readonly builder: PrintFileBuilder;
}

const folder = (ref: string): string => ref.replace(/[^A-Za-z0-9._-]/g, "_").replace(/\.{2,}/g, "_").replace(/^\.+/, "").slice(0, 60) || "order";

export const README = [
  "Print files for one factory batch, one folder per order.",
  "Files are built again from the release's frozen settings. manifest.csv lists each file with its SHA-256.",
  "A line that says 'differs from the release' means the file's hash is not the one frozen with the release: do not print it, ask Knitwright.",
  "",
].join("\r\n");

/** Builds every file of every order once and packs them. The zip carries no clock: the same inputs give the same zip. */
export async function printZip(releases: readonly ReleaseFiles[]): Promise<Uint8Array> {
  const made: MadeFile[] = [];
  const ordered = [...releases].sort((a, b) => (a.orderRef < b.orderRef ? -1 : a.orderRef > b.orderRef ? 1 : 0));
  for (const release of ordered) {
    for (const { path, spec } of plannedFiles(release.specs)) {
      const file = await release.builder.build(spec);
      const frozen = release.frozen.get(path);
      const warnings = [...file.warnings, ...(frozen !== undefined && frozen !== file.sha256 ? ["differs from the release"] : []), ...(frozen === undefined ? ["not in the release"] : [])];
      const player = spec.playerNumber === undefined ? null : (release.roster?.find((r) => r.number === spec.playerNumber) ?? { name: "", number: spec.playerNumber, sizeLabel: spec.size, cut: "unisex" as const, quantity: 1 });
      made.push({
        entry: { path: `${folder(release.orderRef)}/${path}`, spec, transferOnly: false, player },
        file: { bytes: file.bytes, sha256: file.sha256, pageWidthMm: file.pageWidthMm, pageHeightMm: file.pageHeightMm, warnings },
      });
    }
  }
  return zipFiles(made, { "README.txt": README });
}
