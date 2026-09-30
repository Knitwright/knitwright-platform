import { describe, expect, it } from "vitest";
import { LAYERS } from "@/lib/flat/model";
import { start } from "@/lib/garment/fixtures/specs";
import { CHARTS, fullDesign, packFor } from "./fixtures/designs";
import { NO_DRAWING } from "./flats";

/** Owner decision 2026-09-30: one flat drawing per colourway. */
describe("the drawing of each colourway", () => {
  const pack = packFor(fullDesign("crew-tee"), { charts: CHARTS });
  const blocks = pack.colourways.colourways;

  it("gives every colourway its own drawing of the front, named after it", () => {
    expect(blocks.map((block) => [block.id, block.drawing.view, block.drawing.label])).toEqual([
      ["main", "front", "Home, front"],
      ["away", "front", "Away, front"],
    ]);
    expect(blocks.every((block) => block.drawing.model !== null)).toBe(true);
  });

  it("draws each in its own colourway", () => {
    expect(blocks.map((block) => block.drawing.model?.colourwayId)).toEqual(["main", "away"]);
    const fills = (index: number) =>
      JSON.stringify(blocks[index]?.drawing.model?.layers.flatMap((layer) => layer.elements.map((element) => ("fill" in element ? element.fill : null))));
    expect(fills(0)).not.toBe(fills(1));
  });

  it("leaves the callouts to the flats section, so a colourway drawing carries no values", () => {
    for (const block of blocks) {
      expect(block.drawing.model?.layers.some((layer) => layer.id === LAYERS.measurements.id)).toBe(false);
    }
    expect(pack.flats.views[0]?.model?.layers.some((layer) => layer.id === LAYERS.measurements.id)).toBe(true);
  });

  it("is to scale when the flats are, and says when it is not", () => {
    expect(blocks.every((block) => block.drawing.toScale)).toBe(true);
    const empty = packFor(start("crew-tee")).colourways.colourways;
    expect(empty).toHaveLength(1);
    expect(empty[0]?.drawing.toScale).toBe(false);
    expect(empty[0]?.drawing.notice).toMatch(/Not to scale/);
  });

  it("says there is no drawing for a garment type without one", () => {
    const spec = { ...start("crew-tee"), typeId: "no-such-type" } as ReturnType<typeof start>;
    const block = packFor(spec).colourways.colourways[0];
    expect(block?.drawing).toMatchObject({ model: null, notice: NO_DRAWING });
  });
});
