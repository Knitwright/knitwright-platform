/**
 * The most work one import may spend matching patterns. Work is counted in renders of a generator and in pixel
 * comparisons, which are the same on every machine, so the same picture gives the same answer. The clock only
 * stops the search early: it can never change what a finished search finds.
 */

export const MATCH_LIMITS = {
  /** Drawings of a generator that are scored against the picture. */
  renders: 120,
  /** Pixels compared with the picture, over all the drawings. */
  comparisons: 120_000_000,
  /** The wall clock, as a safety net. */
  milliseconds: 5000,
} as const;

export interface MatchBudget {
  /** True and counted when another drawing is allowed. */
  takeRender(): boolean;
  /** True and counted when `pixels` more comparisons are allowed. */
  takeComparisons(pixels: number): boolean;
  /** True once the clock ran out. */
  late(): boolean;
  spent(): { readonly renders: number; readonly comparisons: number; readonly stoppedEarly: boolean };
}

export interface MatchLimits {
  readonly renders: number;
  readonly comparisons: number;
  readonly milliseconds: number;
}

export function createMatchBudget(limits: MatchLimits = MATCH_LIMITS, clock: () => number = Date.now): MatchBudget {
  // The clock starts at the first drawing, so time spent reading the picture first is not counted against the matching.
  let started: number | null = null;
  let renders = 0;
  let comparisons = 0;
  let stopped = false;
  const late = (): boolean => {
    if (started !== null && clock() - started > limits.milliseconds) stopped = true;
    return stopped;
  };
  return {
    takeRender: () => {
      started ??= clock();
      if (late() || renders >= limits.renders) return ((stopped = true), false);
      renders += 1;
      return true;
    },
    takeComparisons: (pixels) => {
      started ??= clock();
      if (late() || comparisons + pixels > limits.comparisons) return ((stopped = true), false);
      comparisons += pixels;
      return true;
    },
    late,
    spent: () => ({ renders, comparisons, stoppedEarly: stopped }),
  };
}

export const budgetSentence = (limits: MatchLimits = MATCH_LIMITS): string =>
  `Pattern matching is limited to ${limits.renders} trial drawings, ${limits.comparisons / 1_000_000} million pixel comparisons and ${limits.milliseconds / 1000} seconds for each picture.`;
