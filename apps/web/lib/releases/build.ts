import { rosterHash } from "@/lib/orders/hash";
import type { PrintFileBuilder, PrintFileSpec, PrintProfile, ReleaseSnapshot, RosterRow } from "@/lib/production/contract";
import { AppError } from "@/lib/server/core/errors";

/** Everything a release freezes, apart from the file bytes. */
export interface ReleaseInputs {
  readonly specVersion: number;
  readonly patternBlockId: string;
  readonly patternBlockVersion: number;
  readonly fabricTestIds: readonly string[];
  readonly printProfile: PrintProfile;
  /** The team list the player files were made from. Null for a release with no player files. */
  readonly roster: readonly RosterRow[] | null;
  readonly files: readonly PrintFileSpec[];
}

const safe = (text: string): string => text.replace(/[^A-Za-z0-9._-]/g, "_");

/** A name that says what the file is, such as "print/back-XL-player-10.pdf". */
export const filePath = (spec: PrintFileSpec): string =>
  `print/${safe(spec.pieceId)}-${safe(spec.size)}${spec.playerNumber ? `-player-${spec.playerNumber}` : ""}.${spec.format}`;

const BATCH = 4;
const byPath = (a: { path: string }, b: { path: string }): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

function checkPlayers(inputs: ReleaseInputs): void {
  const numbers = new Set((inputs.roster ?? []).map((r) => Number(r.number)));
  for (const spec of inputs.files) {
    if (spec.playerNumber === undefined) continue;
    if (inputs.roster === null) throw new AppError("invalid_input", "A file for a player needs a team order.");
    if (!numbers.has(Number(spec.playerNumber))) {
      throw new AppError("invalid_input", `The team order has no player with number ${spec.playerNumber}.`);
    }
  }
}

/** Specs in path order, each with its path. Refuses two files that would share a name. */
export function plannedFiles(files: readonly PrintFileSpec[]): readonly { path: string; spec: PrintFileSpec }[] {
  const planned = files.map((spec) => ({ path: filePath(spec), spec })).sort(byPath);
  const clash = planned.find((entry, i) => i > 0 && entry.path === planned[i - 1]?.path);
  if (clash) throw new AppError("invalid_input", `Two files have the same name: ${clash.path}.`);
  return planned;
}

/**
 * Builds every file once and keeps the SHA-256 of each, never the file. The result does not depend
 * on the order the inputs came in, so the same inputs always freeze to the same snapshot.
 */
export async function buildSnapshot(inputs: ReleaseInputs, builder: PrintFileBuilder): Promise<ReleaseSnapshot> {
  checkPlayers(inputs);
  const planned = plannedFiles(inputs.files);
  const files: { path: string; sha256: string }[] = [];
  for (let at = 0; at < planned.length; at += BATCH) {
    const hashed = await Promise.all(
      planned.slice(at, at + BATCH).map(async (entry) => ({ path: entry.path, sha256: (await builder.build(entry.spec)).sha256 })),
    );
    files.push(...hashed);
  }
  return {
    specVersion: inputs.specVersion,
    patternBlockId: inputs.patternBlockId,
    patternBlockVersion: inputs.patternBlockVersion,
    fabricTestIds: [...inputs.fabricTestIds].sort(),
    printProfile: inputs.printProfile,
    rosterHash: inputs.roster === null ? null : rosterHash(inputs.roster),
    files,
  };
}
