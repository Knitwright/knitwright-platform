/**
 * The one seeded integer generator every pattern uses. No `Math.random`, no clock: the same seed and cell always
 * give the same numbers, so a pattern is the same on any machine and on any piece it is cut to.
 */

/** Mixes whole numbers into one unsigned 32 bit hash. */
export function hash32(...values: readonly number[]): number {
  let h = 0x811c9dc5;
  for (const value of values) {
    h = Math.imul(h ^ (Math.trunc(value) | 0), 0x01000193);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x297a2d39);
  return (h ^ (h >>> 16)) >>> 0;
}

export interface Rng {
  /** A number from 0 up to, not including, 1. */
  next(): number;
  range(low: number, high: number): number;
  /** A whole number from `low` to `high`, both included. */
  int(low: number, high: number): number;
}

/** A small, fast generator (mulberry32) started from any whole number. */
export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (low, high) => low + (high - low) * next(),
    int: (low, high) => low + Math.floor(next() * (high - low + 1)),
  };
}

/** A generator for one cell of a pattern: the cell, the seed and a salt for the part of the pattern. */
export const cellRng = (seed: number, salt: number, i: number, j: number): Rng => makeRng(hash32(seed, salt, i, j));
