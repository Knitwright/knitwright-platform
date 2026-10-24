import type { Ring } from "@/lib/print/scene";

const area2 = (ring: Ring): number => ring.reduce((sum, p, i) => {
  const q = ring[(i + 1) % ring.length] as readonly [number, number];
  return sum + p[0] * q[1] - q[0] * p[1];
}, 0);

const cross = (a: readonly number[], b: readonly number[], c: readonly number[]): number =>
  ((b[0] as number) - (a[0] as number)) * ((c[1] as number) - (a[1] as number)) - ((b[1] as number) - (a[1] as number)) * ((c[0] as number) - (a[0] as number));

function inside(p: readonly number[], a: readonly number[], b: readonly number[], c: readonly number[]): boolean {
  return cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
}

/** Drops a point equal to the one before it, and the last when it repeats the first. */
export function withoutRepeats(ring: Ring): Ring {
  const kept = ring.filter((p, i) => i === 0 || p[0] !== (ring[i - 1] as readonly number[])[0] || p[1] !== (ring[i - 1] as readonly number[])[1]);
  const first = kept[0];
  const last = kept.at(-1);
  return kept.length > 1 && first && last && first[0] === last[0] && first[1] === last[1] ? kept.slice(0, -1) : kept;
}

/**
 * Triangles (indices into the ring, anticlockwise) that fill a simple ring, by ear clipping. A ring that is not simple is
 * filled as far as ears can be found and the rest is fanned from its first point, so the result is always a surface.
 */
export function earClip(ring: Ring): readonly (readonly [number, number, number])[] {
  const n = ring.length;
  if (n < 3) return [];
  const live = Array.from({ length: n }, (_, i) => i);
  if (area2(ring) < 0) live.reverse();
  const out: [number, number, number][] = [];
  while (live.length > 3) {
    const at = live.findIndex((_, k) => {
      const [i, j, l] = [live[(k + live.length - 1) % live.length], live[k], live[(k + 1) % live.length]] as [number, number, number];
      const [a, b, c] = [ring[i], ring[j], ring[l]] as [Ring[number], Ring[number], Ring[number]];
      if (cross(a, b, c) <= 0) return false;
      return !live.some((m) => m !== i && m !== j && m !== l && inside(ring[m] as Ring[number], a, b, c) && ![a, b, c].some((q) => q[0] === (ring[m] as Ring[number])[0] && q[1] === (ring[m] as Ring[number])[1]));
    });
    if (at < 0) break;
    const [i, j, l] = [live[(at + live.length - 1) % live.length], live[at], live[(at + 1) % live.length]] as [number, number, number];
    out.push([i, j, l]);
    live.splice(at, 1);
  }
  for (let k = 1; k + 1 < live.length; k += 1) out.push([live[0] as number, live[k] as number, live[k + 1] as number]);
  return out;
}
