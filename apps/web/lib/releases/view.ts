import { proofReadiness } from "@/lib/proofs/readiness";
import { signOffLines, strikeOffSentence, type RoleLine } from "@/lib/proofs/sentences";
import { shrinkTestFrom, type ShrinkTest } from "@/lib/proofs/fabric-test";
import type { SignOff, StrikeOff } from "@/lib/proofs/types";
import type { ReadinessItem } from "@/lib/production/contract";
import type { StoredRelease } from "./service";

export interface StrikeOffView extends StrikeOff {
  readonly sentence: string;
  /** The measured shrink in the shape the fabric part keeps, when both directions were measured. */
  readonly shrinkTest: ShrinkTest | null;
}

export interface ReleaseView {
  readonly id: string;
  readonly number: number;
  readonly label: string;
  readonly createdAt: string;
  readonly orderId: string | null;
  readonly specVersion: number;
  readonly patternBlockId: string;
  readonly patternBlockVersion: number;
  readonly fabricTestIds: readonly string[];
  readonly printProfile: StoredRelease["snapshot"]["printProfile"];
  readonly hasTeamList: boolean;
  readonly files: StoredRelease["snapshot"]["files"];
  readonly signOffs: readonly RoleLine[];
  readonly strikeOffs: readonly StrikeOffView[];
  /** The proofs line of the factory checklist for this release. */
  readonly proofs: ReadinessItem;
}

/** What the release page shows: the frozen inputs, every file hash, who signed and where the strike-offs stand. */
export function releaseView(release: StoredRelease, signOffs: readonly SignOff[], strikeOffs: readonly StrikeOff[]): ReleaseView {
  const mine = strikeOffs.filter((s) => s.releaseId === release.id);
  const { snapshot } = release;
  return {
    id: release.id,
    number: release.number,
    label: release.label,
    createdAt: release.createdAt,
    orderId: release.orderId,
    specVersion: snapshot.specVersion,
    patternBlockId: snapshot.patternBlockId,
    patternBlockVersion: snapshot.patternBlockVersion,
    fabricTestIds: snapshot.fabricTestIds,
    printProfile: snapshot.printProfile,
    hasTeamList: snapshot.rosterHash !== null,
    files: snapshot.files,
    signOffs: signOffLines(signOffs.filter((s) => s.releaseId === release.id)),
    strikeOffs: mine.map((s) => ({ ...s, sentence: strikeOffSentence(s), shrinkTest: shrinkTestFrom(s) })),
    proofs: proofReadiness(mine),
  };
}
