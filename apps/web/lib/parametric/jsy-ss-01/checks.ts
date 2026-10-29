import type { ArticleDefinition } from "../article";
import type { DraftConstantValues } from "../constants";
import { len } from "../geometry";
import type { PomCheck, SeamLength } from "../types";
import type { BodyCurves, SizeMeasures } from "./curves";
import type { Hem } from "./drop-tail";
import { SEAM, type SleeveEdge } from "./pieces";

/** What the sleeve's lower edge is, and the cuff the finish adds below it. */
export type SleeveFinish = Readonly<{
  edge: SleeveEdge;
  cuff: Readonly<{ cutLength: number; finishedDepth: number }> | null;
}>;

/** The sleeve finish this script draws besides K01's own hem. */
export const CUFF_OPTION = "K02";

/**
 * Where the sleeve ends (owner decision 8). POM D is measured to the finished sleeve edge, cuff
 * included, so for K02 the cuff seam is DERIVED by subtracting the cuff's finished depth, and the
 * sleeve's width there is read off the underarm taper rather than assumed to be the opening.
 */
export function sleeveFinish(article: ArticleDefinition, m: SizeMeasures, capH: number, code: string, k: DraftConstantValues): SleeveFinish {
  const sa = article.seam_allowance;
  if (code !== CUFF_OPTION) {
    return { edge: { y: m.D, halfWidth: m.F, seamId: SEAM.sleeveHem, sa: sa.sleeve_hem }, cuff: null };
  }
  const rib = k.cuff_k02.rib;
  const y = m.D - rib.finished_depth_mm;
  const halfWidth = m.E + (m.F - m.E) * ((y - capH) / (m.D - capH));
  return {
    edge: { y, halfWidth, seamId: SEAM.cuffJoin, sa: sa.rib },
    cuff: { cutLength: 2 * m.F - rib.negative_ease_mm, finishedDepth: rib.finished_depth_mm },
  };
}

/** The finished sleeve edge POM D is measured to: the sleeve's own edge plus whatever its finish adds. */
export const finishedSleeveEdge = (f: SleeveFinish): number => f.edge.y + (f.cuff ? f.cuff.finishedDepth : 0);

/** Each measurement built into the pattern, beside the POM value it was meant to have. */
export function draftChecks(m: SizeMeasures, c: BodyCurves, f: SleeveFinish, backHem: Hem): PomCheck[] {
  const drop = backHem.centre[1] - m.B;
  return [
    { label: "A chest half (front panel width at underarm)", target: m.A, actual: 2 * c.cx },
    { label: "C across shoulder", target: m.C, actual: 2 * c.sx },
    { label: "H neck width", target: m.H, actual: 2 * c.hx },
    { label: "I front neck drop", target: m.I, actual: c.fNeck[c.fNeck.length - 1][1] },
    { label: "G armhole depth", target: m.G, actual: c.fArm[c.fArm.length - 1][1] },
    { label: "B body length", target: m.B, actual: m.B },
    { label: "D sleeve length", target: m.D, actual: finishedSleeveEdge(f) },
    { label: "E bicep half (sleeve width / 2)", target: m.E, actual: m.E },
    { label: "F sleeve opening half", target: m.F, actual: m.F },
    { label: "K hem width half", target: m.K, actual: 2 * c.cx },
    ...(drop === 0 ? [] : [{ label: "Back centre drop (back_drop_tail)", target: drop, actual: backHem.centre[1] - m.B }]),
  ];
}

export type CapSolve = Readonly<{ capH: number; capLength: number; frontArmhole: number; backArmhole: number }>;

/** The seam lengths that have to agree with one another, and the rib lengths drawn from them. */
export function draftLengths(cap: CapSolve, neckLen: number, ribLen: number, f: SleeveFinish, backHem: Hem): SeamLength[] {
  return [
    { label: "Front armhole (one side)", mm: cap.frontArmhole },
    { label: "Back armhole (one side)", mm: cap.backArmhole },
    { label: "Sleeve cap, front half", mm: cap.capLength },
    { label: "Sleeve cap, back half", mm: cap.capLength },
    { label: "Total ease, cap vs armhole", mm: 2 * cap.capLength - cap.frontArmhole - cap.backArmhole },
    { label: "Sleeve cap height", mm: cap.capH },
    { label: "Neckline seam (full)", mm: neckLen },
    { label: "Rib length (finished seam line)", mm: ribLen },
    ...(backHem.centre[1] === backHem.pts[0][1] ? [] : [{ label: "Back hem seam with the drop tail (full)", mm: len(backHem.pts) }]),
    ...(f.cuff
      ? [
          { label: "Sleeve edge at the cuff seam (derived, full width)", mm: 2 * f.edge.halfWidth },
          { label: "Cuff K02 cut length (sleeve opening less the rib negative ease)", mm: f.cuff.cutLength },
        ]
      : []),
  ];
}
