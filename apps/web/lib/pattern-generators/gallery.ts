import type { DisplayList } from "@/lib/artwork-stack/generator";
import { GENERATORS } from "./registry";
import { presetsFor } from "./presets";

/** The size of a gallery picture, in millimetres of design: a piece-shaped swatch. */
export const TILE_MM = { width: 240, height: 320 } as const;

export interface GalleryTile {
  readonly generatorId: string;
  readonly presetId: string;
  readonly generatorLabel: string;
  readonly label: string;
  readonly list: DisplayList;
}

/** One small drawing for each preset of each style, in the club's colours (main first) over the ground. */
export function galleryTiles(colours: readonly string[], ground: string): GalleryTile[] {
  return GENERATORS.flatMap((generator) =>
    presetsFor(generator.id).map((preset) => ({
      generatorId: generator.id,
      presetId: preset.id,
      generatorLabel: generator.label,
      label: preset.label,
      list: generator.render({
        view: "front",
        bounds: { minX: 0, minY: 0, maxX: TILE_MM.width, maxY: TILE_MM.height },
        landmarks: { underarm: { x: TILE_MM.width, y: TILE_MM.height / 3 } },
        datum: { x: 0, y: TILE_MM.height / 4 },
        colours: colours.slice(0, Math.max(1, Math.min(preset.colours, generator.maxColours))),
        ground,
        params: preset.params,
        seed: preset.seed,
      }),
    })),
  );
}
