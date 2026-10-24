import { swatchForName } from "../colour-names";

/**
 * Colour comparison and the deterministic colour reader. Distance is CIE76 delta E in Lab,
 * computed from sRGB with a D65 white. The tolerance is a setting, not a measurement: 20 is
 * "the same named colour family" on a screen. It is Knitwright's own choice, not a factory's.
 */
export const COLOUR_TOLERANCE = 20;

type Lab = readonly [number, number, number];

const linear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

function toLab(code: string): Lab {
  const [r, g, b] = [1, 3, 5].map((start) => linear(Number.parseInt(code.slice(start, start + 2), 16)));
  const xyz = [
    (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883,
  ].map((t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116));
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}

/** The distance between two `#rrggbb` colours. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * How many expected colours were found within the tolerance, and how many found colours matched
 * none. Each found colour pairs with one expected colour, the nearest pairs first.
 */
export function matchColours(expected: readonly string[], found: readonly string[], tolerance = COLOUR_TOLERANCE): { matched: number; extra: number } {
  const pairs = expected
    .flatMap((want, i) => found.map((got, j) => ({ i, j, distance: deltaE(want, got) })))
    .filter((pair) => pair.distance <= tolerance)
    .sort((x, y) => x.distance - y.distance || x.i - y.i || x.j - y.j);
  const usedExpected = new Set<number>();
  const usedFound = new Set<number>();
  for (const pair of pairs) {
    if (usedExpected.has(pair.i) || usedFound.has(pair.j)) continue;
    usedExpected.add(pair.i);
    usedFound.add(pair.j);
  }
  return { matched: usedExpected.size, extra: found.length - usedFound.size };
}

const LONGEST_NAME = 3;
const HEX_CODE = /#[0-9a-f]{6}\b/gi;

/**
 * The colours a text names, by the table in `colour-names.ts` and by hex code, in the order
 * written, each once. A name the table does not list is not found.
 */
export function extractColours(text: string): string[] {
  const hits: { at: number; code: string }[] = [];
  for (const match of text.matchAll(HEX_CODE)) hits.push({ at: match.index, code: match[0].toLowerCase() });
  const tokens = [...text.toLowerCase().matchAll(/[a-z]+/g)].map((match) => ({ at: match.index, word: match[0] }));
  let index = 0;
  while (index < tokens.length) {
    let length = Math.min(LONGEST_NAME, tokens.length - index);
    let swatch: string | undefined;
    while (length >= 1 && swatch === undefined) {
      swatch = swatchForName(tokens.slice(index, index + length).map((token) => token.word).join(" "));
      if (swatch === undefined) length -= 1;
    }
    if (swatch === undefined) index += 1;
    else {
      hits.push({ at: tokens[index].at, code: swatch });
      index += length;
    }
  }
  const codes = hits.sort((x, y) => x.at - y.at).map((hit) => hit.code);
  return codes.filter((code, position) => codes.indexOf(code) === position);
}
