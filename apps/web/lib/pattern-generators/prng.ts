/**
 * The one small seeded generator every pattern uses. Integer maths only (a splitmix style mixer), so the same seed gives
 * the same numbers on any machine. `Math.random` is never used in this library.
 */

export interface Rng {
  /** The next whole number, 0 to 4 294 967 295. */
  next(): number;
  /** The next number from 0 up to, not including, 1. */
  float(): number;
  /** A whole number from 0 up to, not including, `limit`. */
  int(limit: number): number;
  /** A number from `low` up to, not including, `high`. */
  range(low: number, high: number): number;
}

const GOLDEN = 0x9e3779b9;

/** Mixes whole numbers into one 32 bit number. Cells of a field are seeded with their own position, so a cell looks the same whatever area is drawn. */
export function hashSeed(...parts: readonly number[]): number {
  const folded = parts.reduce((hash, part) => {
    const mixed = Math.imul(hash ^ Math.trunc(part), 0x01000193);
    return (mixed ^ (mixed >>> 15)) | 0;
  }, 0x811c9dc5 | 0);
  const a = Math.imul(folded ^ (folded >>> 16), 0x85ebca6b);
  const b = Math.imul(a ^ (a >>> 13), 0xc2b2ae35);
  return (b ^ (b >>> 16)) >>> 0;
}

export function createRng(seed: number): Rng {
  let state = Math.trunc(seed) | 0;
  const next = (): number => {
    state = (state + GOLDEN) | 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  const float = (): number => next() / 4_294_967_296;
  return {
    next,
    float,
    int: (limit) => Math.floor(float() * limit),
    range: (low, high) => low + float() * (high - low),
  };
}
