import type { Layer } from "@/lib/artwork-stack";
import type { BuildEnv, PieceRequest } from "./context";

const mm = (v: number): string => `${(Math.round(v * 10) / 10).toFixed(1)} mm`;

/**
 * Where a repeat agrees with the pieces next to it, and where it cannot. A repeat is fixed to one datum per view, so rows
 * meet at the side seam at the chest line; across a shoulder or an armhole they can agree only at the named points.
 */
export function agreementNotes(env: BuildEnv, layers: readonly Layer[], req: PieceRequest): string[] {
  if (!layers.some((l) => l.kind === "pattern" || l.kind === "image-fill")) return [];
  const a = env.mapper.rowAgreement(req.size);
  if (req.view === "front" || req.view === "back") {
    return [
      `Repeat rows meet the other body piece at the side seam at the chest line (${mm(a.sideSeamMm)} out). At the shoulder seam the rows differ by up to ${mm(a.shoulderMm)}.`,
    ];
  }
  if (req.view === "sleeve-left" || req.view === "sleeve-right") {
    return [
      `Repeat rows meet the body at the shoulder point (${mm(a.sleeveShoulderMm)} out). They differ by ${mm(a.sleeveUnderarmMm)} at the underarm, because a sleeve cap is curved.`,
    ];
  }
  return [];
}
