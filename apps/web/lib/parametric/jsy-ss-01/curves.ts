import type { DraftConstantValues } from "../constants";
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

type Curves = DraftConstantValues["curves"];
export type CapConstants = Curves["sleeve_cap"];

/**
 * The neck and armhole curves of the front and back, right half (the script's first block). Every
 * control point comes from the article's drafting constants, so the shape of the block is data.
 */
export function bodyCurves(m: SizeMeasures, k: Curves): BodyCurves {
  const cx = m.A / 2;
  const sx = m.C / 2;
  const hx = m.H / 2;
  const { G, I, J, slope } = m;
  const depth = G - slope;
  return {
    cx,
    sx,
    hx,
    // HPS -> centre front
    fNeck: bez([hx, 0], [hx, I * k.front_neck.control_1_drop_fraction], [hx * k.front_neck.control_2_width_fraction, I], [0, I]),
    // shoulder point -> underarm
    fArm: bez(
      [sx, slope],
      [sx - k.front_armhole.control_1_inset_fraction * depth, slope + k.front_armhole.control_1_drop_fraction * depth],
      [sx - k.front_armhole.control_2_inset_mm, G],
      [cx, G],
    ),
    bNeck: bez(
      [hx, 0],
      [hx - k.back_neck.control_1_inset_mm, J * k.back_neck.control_1_drop_fraction],
      [hx * k.back_neck.control_2_width_fraction, J],
      [0, J],
    ),
    bArm: bez(
      [sx, slope],
      [sx - k.back_armhole.control_1_inset_fraction * depth, slope + k.back_armhole.control_1_drop_fraction * depth],
      [sx - k.back_armhole.control_2_inset_mm, G],
      [cx, G],
    ),
  };
}

const capCurve = (E: number, capH: number, k: CapConstants): Pt[] =>
  bez([E, capH], [E * k.control_1_width_fraction, capH], [E * k.control_2_width_fraction, 0], [0, 0]);

/**
 * Solves the sleeve cap height so each half of the cap is half the armhole plus half the ease.
 * The ease, the bracket and the number of halvings are the article's constants, as the script's
 * own values. The cap runs underarm -> top.
 */
export function solveCap(E: number, frontArmhole: number, backArmhole: number, k: CapConstants): { capH: number; cap: Pt[] } {
  const target = (frontArmhole + backArmhole + k.ease_mm) / 2;
  let [lo, hi] = k.solve_bracket_mm;
  for (let it = 0; it < k.solve_halvings; it++) {
    const capH = (lo + hi) / 2;
    if (len(capCurve(E, capH, k)) > target) hi = capH;
    else lo = capH;
  }
  const capH = (lo + hi) / 2;
  return { capH, cap: capCurve(E, capH, k) };
}
