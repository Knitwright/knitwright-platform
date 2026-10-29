import { bez, len, type Pt } from "../geometry";

/** The measurements one size is drafted from, after the parameters are applied. */
export type SizeMeasures = Readonly<{
  /** Chest half (A), body length (B, with its offset), across shoulder (C), sleeve length (D, with its offset). */
  A: number;
  B: number;
  C: number;
  D: number;
  /** Bicep half (E), sleeve opening half (F), armhole depth (G), neck width (H), front and back neck drop (I, J). */
  E: number;
  F: number;
  G: number;
  H: number;
  I: number;
  J: number;
  /** Hem width half (K) and neck rib height, finished (L). */
  K: number;
  L: number;
  slope: number;
}>;

export type BodyCurves = Readonly<{
  cx: number;
  sx: number;
  hx: number;
  fNeck: Pt[];
  bNeck: Pt[];
  fArm: Pt[];
  bArm: Pt[];
}>;

/** The neck and armhole curves of the front and back, right half (the script's first block). */
export function bodyCurves(m: SizeMeasures): BodyCurves {
  const cx = m.A / 2;
  const sx = m.C / 2;
  const hx = m.H / 2;
  const { G, I, J, slope } = m;
  return {
    cx,
    sx,
    hx,
    // HPS -> centre front
    fNeck: bez([hx, 0], [hx, I * 0.55], [hx * 0.5, I], [0, I]),
    // shoulder point -> underarm
    fArm: bez([sx, slope], [sx - 0.12 * (G - slope), slope + 0.4 * (G - slope)], [sx - 10, G], [cx, G]),
    bNeck: bez([hx, 0], [hx - 5, J * 0.8], [hx * 0.5, J], [0, J]),
    bArm: bez([sx, slope], [sx - 0.08 * (G - slope), slope + 0.4 * (G - slope)], [sx - 5, G], [cx, G]),
  };
}

/** The total ease the cap is drafted to: 3 mm, inside the article's 0 to 6 mm target (R-PAT-007). */
export const CAP_EASE_MM = 3;

const capCurve = (E: number, capH: number): Pt[] => bez([E, capH], [E * 0.6, capH], [E * 0.35, 0], [0, 0]);

/**
 * Solves the sleeve cap height so each half of the cap is half the armhole plus half the ease.
 * Forty halvings of the 30 to 200 mm bracket, as the script does. The cap runs underarm -> top.
 */
export function solveCap(E: number, frontArmhole: number, backArmhole: number): { capH: number; cap: Pt[] } {
  const target = (frontArmhole + backArmhole + CAP_EASE_MM) / 2;
  let lo = 30;
  let hi = 200;
  for (let it = 0; it < 40; it++) {
    const capH = (lo + hi) / 2;
    if (len(capCurve(E, capH)) > target) hi = capH;
    else lo = capH;
  }
  const capH = (lo + hi) / 2;
  return { capH, cap: capCurve(E, capH) };
}
