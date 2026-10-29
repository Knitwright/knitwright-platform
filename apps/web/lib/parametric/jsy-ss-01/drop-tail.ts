import type { DraftConstantValues } from "../constants";
import { bez, len, line, mir, rev, type Pt } from "../geometry";

/**
 * The back hem of a drop tail, drafted to the convention of plan v5 owner decision 6. The four
 * facts of that convention are drafting constants, not code: a convention the script cannot draw
 * stops the draft (`conventionProblem`) rather than being drawn differently from what it says.
 */

type Convention = DraftConstantValues["drop_tail"]["convention"];

/** The one convention this script draws. */
export const DRAWN_CONVENTION = Object.freeze({ dropStartsAt: "side-seam", backHemCurve: "one-smooth-curve" });

/** Why the convention on file cannot be drawn, or null when it can. */
export function conventionProblem(c: Convention): string | null {
  if (!c.hem_level_to_side_seam) return "the hem is not level from centre front to the side seam";
  if (c.drop_starts_at !== DRAWN_CONVENTION.dropStartsAt) return `the drop starts at the ${c.drop_starts_at}, not at the side seam`;
  if (!c.side_seam_length_unchanged) return "the side-seam length is not kept";
  if (c.front_hem_moves) return "the front hem moves";
  if (c.back_hem_curve !== DRAWN_CONVENTION.backHemCurve) return `the back hem is ${c.back_hem_curve}, not one smooth curve`;
  if (!c.horizontal_at_centre_back) return "the back hem is not horizontal where it meets the centre-back fold";
  return null;
}

/** A hem drawn in cutting order, right side seam to left, with its centre point and arc length. */
export type Hem = Readonly<{ pts: Pt[]; centre: Pt; centreDistance: number }>;

/**
 * The hem from the right side seam to the left. `drop` mm of drop tail curves it down to the
 * centre-back fold: it leaves the side seam at the front hem's level, so the side seam keeps its
 * length and the front hem never moves, and it arrives horizontal at the fold. No drop gives the
 * level hem the reference script draws, point for point.
 */
export function hemLine(cx: number, hemY: number, drop: number, c: Convention): Hem {
  if (drop === 0) return { pts: line([cx, hemY], [-cx, hemY]), centre: [0, hemY], centreDistance: cx };
  const low = hemY + drop;
  const half = bez([cx, hemY], [cx - cx * c.side_control_fraction, hemY], [cx * c.centre_control_fraction, low], [0, low]);
  return { pts: [...half, ...rev(mir(half)).slice(1)], centre: [0, low], centreDistance: len(half) };
}
