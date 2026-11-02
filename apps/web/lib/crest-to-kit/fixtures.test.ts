import { describe, expect, it } from "vitest";
import { toLab } from "@/lib/colour/convert";
import { deltaE2000 } from "@/lib/media-check/ciede2000";
import { articleBook } from "@/lib/teamwear/fixtures/kit";
import { candidateKits } from "./engine";
import { crestColours, dominantOf } from "./palette";
import { crestFixtures, fixtureColours, FIXTURE_COUNT, crestPixels } from "./fixtures/crests";

/**
 * Spec F-T2's acceptance test, measured: "95% of a 100-crest test set yields kits whose primary
 * colour matches the crest's dominant colour (ΔE00 < 5)".
 *
 * The figure is CIEDE2000 between the crest's own dominant colour and the body colour of the kits
 * built from it, over the hundred generated crests of `fixtures/crests.ts`. Both colours are screen
 * colours read as sRGB with a D65 white point and the 2-degree observer (owner decision 15); the
 * difference is not a measurement of printed fabric, and the test does not claim it is.
 *
 * Two things can move a kit's body colour away from the crest's dominant one: the clustering in
 * `lib/colour/palette.ts`, and the snap to the gamut `lib/guardrails/gamut.ts` estimates. The
 * fixtures are drawn in flat colours, so the clustering recovers each one exactly; what this test
 * therefore measures is the gamut snap, which is the honest thing to measure, because that snap is
 * what a club's shirt would actually be printed in.
 */

/** The specification's own threshold and share. */
const DELTA_LIMIT = 5;
const SHARE = 0.95;

const articles = articleBook();

/** The body colour of the kits a crest yields, or null when it yields none. */
const bodyColourOf = (index: number): string | null => {
  const palette = crestColours(crestPixels(index));
  const built = candidateKits({ sportId: "football", feel: "classic", roles: "home", palette, articles, crest: null });
  return built.status === "kits" ? (built.candidates[0]?.kit.colours.main ?? null) : null;
};

describe("the hundred-crest fixture set", () => {
  it("holds a hundred crests, each generated, each with three colours and no committed artwork", () => {
    const set = crestFixtures();
    expect(set).toHaveLength(FIXTURE_COUNT);
    expect(new Set(set.map((one) => one.id)).size).toBe(FIXTURE_COUNT);
    for (const one of set) {
      expect(one.colours).toHaveLength(3);
      for (const colour of one.colours) expect(colour).toMatch(/^#[0-9a-f]{6}$/);
      expect(one.pixels.width * one.pixels.height * 4).toBe(one.pixels.data.length);
    }
  });

  it("is the same set on every run", () => {
    expect(fixtureColours(7)).toEqual(fixtureColours(7));
    expect(crestFixtures(3).map((one) => one.colours)).toEqual(crestFixtures(3).map((one) => one.colours));
  });

  it("reads each crest's dominant colour as the colour it was drawn in", () => {
    for (let index = 0; index < 12; index += 1) {
      const dominant = dominantOf(crestColours(crestPixels(index)));
      expect(dominant, `crest ${index}`).not.toBeNull();
      expect(deltaE2000(toLab(dominant!.hex), toLab(fixtureColours(index)[0])), `crest ${index}`).toBeLessThan(1);
    }
  });
});

describe("the primary colour of the kits a crest yields", () => {
  it("is within ΔE00 5 of the crest's dominant colour for at least 95 of the hundred", () => {
    const measured = Array.from({ length: FIXTURE_COUNT }, (_, index) => {
      const main = bodyColourOf(index);
      return main === null ? Number.POSITIVE_INFINITY : deltaE2000(toLab(fixtureColours(index)[0]), toLab(main));
    });
    const within = measured.filter((delta) => delta < DELTA_LIMIT).length;
    // Printed on a failure so the pull request can quote the measured figure, not a guess.
    expect(within / FIXTURE_COUNT, `within ΔE00 ${DELTA_LIMIT}: ${within} of ${FIXTURE_COUNT}`).toBeGreaterThanOrEqual(SHARE);
  });

  it("yields kits for every crest in the set", () => {
    for (let index = 0; index < FIXTURE_COUNT; index += 1) expect(bodyColourOf(index), `crest ${index}`).not.toBeNull();
  });
});
