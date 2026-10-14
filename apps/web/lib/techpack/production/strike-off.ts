import type { ProductionInput, StrikeOffRecord } from "./input";

/** The strike-off, only when it was made for the frozen release. A strike-off for another release says nothing about this one. */
export function strikeOffForRelease(input: Pick<ProductionInput, "strikeOff" | "release">): StrikeOffRecord | null {
  const strike = input.strikeOff ?? null;
  return strike !== null && input.release != null && strike.releaseId === input.release.id ? strike : null;
}

/** Why a strike-off on file does not count, or null when there is none on file or it counts. */
export function strikeOffMismatch(input: Pick<ProductionInput, "strikeOff" | "release">): string | null {
  const strike = input.strikeOff ?? null;
  if (strike === null || strikeOffForRelease(input) !== null) return null;
  const release = input.release ?? null;
  return release === null
    ? `The strike-off on file was made for release ${strike.releaseId}, and no release is frozen yet.`
    : `The strike-off on file was made for release ${strike.releaseId}, not for release ${release.id}.`;
}
