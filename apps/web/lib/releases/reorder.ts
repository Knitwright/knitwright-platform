import type { PrintFileBuilder, PrintFileSpec, PrintProfile, ReleaseSnapshot } from "@/lib/production/contract";
import { plannedFiles } from "./build";

/** What the design, pattern, fabric and print settings are now. The roster is a hash: names stay out. */
export interface CurrentState {
  readonly specVersion: number;
  readonly patternBlockId: string;
  readonly patternBlockVersion: number;
  readonly fabricTestIds: readonly string[];
  readonly printProfile: PrintProfile;
  readonly rosterHash: string | null;
}

export type DifferenceCode =
  | "design-version"
  | "pattern"
  | "fabric-tests"
  | "print-profile"
  | "team-list"
  | "files-differ";

export interface Difference {
  readonly code: DifferenceCode;
  /** One plain sentence that says what changed. */
  readonly message: string;
}

export interface FileComparison {
  readonly path: string;
  readonly status: "same" | "changed" | "missing";
}

export interface ReorderReport {
  /** True only when nothing changed and every file came out byte for byte the same. */
  readonly identical: boolean;
  readonly differences: readonly Difference[];
  readonly files: readonly FileComparison[];
}

const PROFILE_FIELDS: readonly (readonly [keyof PrintProfile, string])[] = [
  ["bleedMm", "bleed"],
  ["dpi", "resolution (dpi)"],
  ["maxPrintWidthMm", "widest print"],
  ["iccFileId", "colour profile file"],
  ["source", "where the settings came from"],
];

const show = (value: unknown): string => (value === null || value === undefined ? "not set" : String(value));

function profileChanges(then: PrintProfile, now: PrintProfile): Difference[] {
  return PROFILE_FIELDS.filter(([key]) => then[key] !== now[key]).map(([key, label]) => ({
    code: "print-profile" as const,
    message: `The print profile changed: ${label} was ${show(then[key])} and is now ${show(now[key])}.`,
  }));
}

const same = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && [...a].sort().every((id, i) => id === [...b].sort()[i]);

/** The reasons the inputs differ, in plain words. Empty when none do. */
export function inputDifferences(snapshot: ReleaseSnapshot, now: CurrentState): readonly Difference[] {
  const found: Difference[] = [];
  if (snapshot.specVersion !== now.specVersion) {
    found.push({ code: "design-version", message: `The design changed: the release is from version ${snapshot.specVersion}, and the design is now at version ${now.specVersion}.` });
  }
  if (snapshot.patternBlockId !== now.patternBlockId || snapshot.patternBlockVersion !== now.patternBlockVersion) {
    found.push({ code: "pattern", message: "The pattern changed since the release was made." });
  }
  if (!same(snapshot.fabricTestIds, now.fabricTestIds)) {
    found.push({ code: "fabric-tests", message: `The fabric tests changed (the release used ${snapshot.fabricTestIds.join(", ") || "none"}; now ${now.fabricTestIds.join(", ") || "none"}), so the print scale may differ.` });
  }
  found.push(...profileChanges(snapshot.printProfile, now.printProfile));
  if (snapshot.rosterHash !== now.rosterHash) {
    found.push({ code: "team-list", message: now.rosterHash === null ? "The team list is no longer there. It may have been erased." : "The team list changed since the release was made." });
  }
  return found;
}

/**
 * Builds the release's files again and compares each with the hash it was frozen with. Nothing is
 * sent anywhere: the report says whether the files are the same and, when they are not, why. A
 * person chooses what to do next.
 */
export async function compareToRelease(
  snapshot: ReleaseSnapshot,
  fileSpecs: readonly PrintFileSpec[],
  now: CurrentState,
  builder: PrintFileBuilder,
): Promise<ReorderReport> {
  const frozen = new Map(snapshot.files.map((f) => [f.path, f.sha256]));
  const files: FileComparison[] = [];
  for (const { path, spec } of plannedFiles(fileSpecs)) {
    const built = await builder.build(spec);
    files.push({ path, status: frozen.get(path) === built.sha256 ? "same" : "changed" });
    frozen.delete(path);
  }
  // A file the release holds that the settings no longer build.
  files.push(...[...frozen.keys()].sort().map((path) => ({ path, status: "missing" as const })));
  const differences = [...inputDifferences(snapshot, now)];
  const changed = files.some((f) => f.status !== "same");
  if (changed && differences.length === 0) {
    differences.push({ code: "files-differ", message: "The files came out differently although none of the settings changed. The print software may have changed." });
  }
  return { identical: differences.length === 0 && !changed, differences, files };
}
