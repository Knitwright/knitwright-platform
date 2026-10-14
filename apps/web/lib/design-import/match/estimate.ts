import type { ParamSpec } from "@/lib/artwork-stack/generator";

/**
 * First guesses for a generator's settings, from the picture's repeat and how much of the block is ink. A guess is
 * only a start: the search scores it and tunes it. Sizes are in millimetres. A style is listed here only when its
 * settings can be read from a repeat; the others are not tried, and no setting is invented for them.
 */

export interface Measured {
  /** One period in millimetres along each axis, or null when the picture does not repeat along it. */
  readonly xMm: number | null;
  readonly yMm: number | null;
  /** The share of the scored block that is not the colour under the pattern, 0 to 1. */
  readonly inkShare: number;
  /** How many ink colours the block holds. */
  readonly inks: number;
}

export interface Candidate {
  readonly generatorId: string;
  readonly start: Readonly<Record<string, number | boolean>>;
  /** Numeric settings the search may nudge. */
  readonly tune: readonly string[];
  /** Whether moving the datum moves the pattern. The older dots anchor to the piece, so for them a start position is only noted. */
  readonly movesWithDatum: boolean;
  readonly seed: number;
}

const within = (spec: Pick<ParamSpec, "min" | "max">, value: number): number => Math.min(spec.max, Math.max(spec.min, value));

const DOT_LIMITS = {
  dotWidthMm: { min: 0.5, max: 400 },
  pitchMm: { min: 5, max: 800 },
  rowStepMm: { min: 5, max: 800 },
} as const;

/** Polka dots: a pitch along the row, rows a step apart, rows shifted by half a pitch or not. */
function dots(m: Measured): Candidate[] {
  if (m.xMm === null || m.yMm === null) return [];
  const { xMm, yMm } = m;
  const variants: readonly { halfDrop: boolean; rows: number; perCell: number }[] = [
    { halfDrop: true, rows: 2, perCell: 2 },
    { halfDrop: false, rows: 1, perCell: 1 },
    ...(m.inks >= 2 ? [{ halfDrop: false, rows: 2, perCell: 2 }] : []),
  ];
  return variants.map((v) => {
    const pitchMm = within(DOT_LIMITS.pitchMm, xMm);
    const rowStepMm = within(DOT_LIMITS.rowStepMm, yMm / v.rows);
    const area = Math.max(m.inkShare, 0.01) * xMm * yMm;
    const dotWidthMm = within({ min: DOT_LIMITS.dotWidthMm.min, max: Math.min(DOT_LIMITS.dotWidthMm.max, pitchMm * 0.95) }, 2 * Math.sqrt(area / (v.perCell * Math.PI)));
    return { generatorId: "kit-dots", start: { dotWidthMm, pitchMm, rowStepMm, halfDrop: v.halfDrop }, tune: ["dotWidthMm", "pitchMm", "rowStepMm"], movesWithDatum: false, seed: 0 };
  });
}

const STRIPE_WIDTH = { min: 5, max: 100 } as const;

/** The directions a stripe may run, given how far apart the repeats fall along each axis. The normal's period is found from both. */
function stripeAngles(xMm: number | null, yMm: number | null): { angle: number; period: number }[] {
  if (xMm !== null && yMm === null) return [{ angle: 90, period: xMm }];
  if (xMm === null && yMm !== null) return [{ angle: 0, period: yMm }];
  if (xMm === null || yMm === null) return [];
  const period = 1 / Math.hypot(1 / xMm, 1 / yMm);
  const [nx, ny] = [period / xMm, period / yMm];
  // The stripe runs along (ny, -nx) or (ny, nx), whichever way the lean goes.
  return [Math.atan2(-nx, ny), Math.atan2(nx, ny)].map((radians) => ({ angle: Math.round((((radians * 180) / Math.PI) % 180) + 180) % 180, period }));
}

/** Stripes of one width, even rhythm, at the angle the repeats imply. */
function stripes(m: Measured): Candidate[] {
  return stripeAngles(m.xMm, m.yMm).map(({ angle, period }) => ({
    generatorId: "stripe-variations",
    start: { rhythm: 0, width: within(STRIPE_WIDTH, period / 2), angle, grow: 0.5 },
    tune: ["width", "angle"],
    movesWithDatum: true,
    seed: 0,
  }));
}

const CAMO_SCALE = { min: 30, max: 120 } as const;

/** Camo cannot be read from a repeat (its blobs are seeded), so one drawing at a scale from the repeat is tried: it is the generator's honest chance. */
function camo(m: Measured): Candidate[] {
  const sizes = [m.xMm, m.yMm].filter((v): v is number => v !== null);
  if (sizes.length === 0) return [];
  return [{ generatorId: "camo", start: { scale: within(CAMO_SCALE, Math.min(...sizes) / 2) }, tune: [], movesWithDatum: true, seed: 0 }];
}

/** Every start worth scoring for this measure, in the order they are tried. */
export const candidatesFor = (m: Measured): Candidate[] => [...dots(m), ...stripes(m), ...camo(m)];

/** Relative nudges tried in turn, large first. */
export const NUDGES: readonly number[] = [0.08, 0.04, 0.02, 0.01];
