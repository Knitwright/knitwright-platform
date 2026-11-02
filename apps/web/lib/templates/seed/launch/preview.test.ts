import { describe, expect, it } from "vitest";
import { previewOf } from "../../preview";
import { allSeedTemplates } from "../all";

/**
 * The thumbnail of every starter, drawn here from the design itself and from nothing else: the flat is
 * rendered to an SVG data address (`lib/templates/preview.ts`), so nothing in it can run and no
 * third-party picture is involved. A card with no drawing says "No drawing yet", which is honest but is
 * not what a library should look like, so this test says which garments have one.
 */

const seeds = allSeedTemplates();

describe("the thumbnail of every design template", () => {
  it("is drawn from the design, as a data address, with words for a screen reader", () => {
    const drawn = seeds.map((seed) => ({ slug: seed.slug, articleId: seed.articleId, preview: previewOf(seed.snapshot) }));
    for (const entry of drawn.filter((row) => row.preview !== null)) {
      expect(entry.preview!.src, entry.slug).toMatch(/^data:image\/svg\+xml/u);
      expect(entry.preview!.alt.length, entry.slug).toBeGreaterThan(0);
    }
    // Named rather than counted: a garment whose flat the drawing code does not build yet is listed in
    // the pull request, and its card says "No drawing yet" instead of looking ready.
    expect([...new Set(drawn.filter((row) => row.preview === null).map((row) => row.articleId))].sort()).toEqual([]);
  });

  it("is the same drawing every time, so nothing in the library moves on its own", () => {
    const once = previewOf(seeds[0]!.snapshot);
    expect(previewOf(seeds[0]!.snapshot)).toEqual(once);
  });
});
