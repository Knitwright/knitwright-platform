import { rosterHash } from "@/lib/orders/hash";
import { inputDifferences, type Difference } from "@/lib/releases/reorder";
import type { ReleaseSnapshot, RosterRow } from "@/lib/production/contract";

/**
 * What the reorder screen says about the earlier release. It reuses the release reorder's own
 * comparison (decision 0032) for the design version and the team list. The pattern, fabric tests,
 * print profile and the files themselves are the print software's to compare, and the club screen
 * has no way to read them, so it says they were not compared instead of pretending.
 */
export const NOT_COMPARED: readonly string[] = [
  "The pattern, the fabric tests and the print settings were not compared with the release.",
  "The print files were not built again, so nothing here says they would print the same.",
];

export interface ReorderReport {
  readonly identical: boolean;
  readonly differences: readonly Difference[];
  readonly notCompared: readonly string[];
}

export function reorderReport(snapshot: ReleaseSnapshot, currentVersion: number, rows: readonly RosterRow[]): ReorderReport {
  const differences = inputDifferences(snapshot, {
    specVersion: currentVersion,
    patternBlockId: snapshot.patternBlockId,
    patternBlockVersion: snapshot.patternBlockVersion,
    fabricTestIds: snapshot.fabricTestIds,
    printProfile: snapshot.printProfile,
    rosterHash: rosterHash(rows),
  });
  return { identical: differences.length === 0, differences, notCompared: NOT_COMPARED };
}
