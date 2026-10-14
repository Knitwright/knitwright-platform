import type { ReactNode } from "react";
import type { DisplayShape } from "@/lib/artwork-stack/generator";
import { TILE_MM, type GalleryTile } from "@/lib/pattern-generators/gallery";

type GalleryProps = Readonly<{
  tiles: readonly GalleryTile[];
  /** What goes under each picture, such as a button that picks it. */
  action?: (tile: GalleryTile) => ReactNode;
}>;

const pointsText = (points: readonly { x: number; y: number }[]): string => points.map((point) => `${point.x},${point.y}`).join(" ");

function Shape({ shape }: Readonly<{ shape: DisplayShape }>) {
  return shape.kind === "circle" ? (
    <circle cx={shape.centre.x} cy={shape.centre.y} r={shape.radius} fill={shape.fill} />
  ) : (
    <polygon points={pointsText(shape.points)} fill={shape.fill} />
  );
}

/**
 * One small drawing of each pattern style and preset, in the club's colours. Each picture has a plain label. The
 * pictures are for choosing a look; the settings (bigger, tighter, more green) are changed afterwards.
 */
export function GeneratorGallery({ tiles, action }: GalleryProps) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="generator-gallery">
      {tiles.map((tile) => (
        <li key={tile.presetId} className="flex flex-col gap-2">
          <svg
            role="img"
            aria-label={`${tile.generatorLabel}, ${tile.label}`}
            viewBox={`0 0 ${TILE_MM.width} ${TILE_MM.height}`}
            className="w-full rounded-xl border border-hairline bg-surface"
            overflow="hidden"
          >
            {tile.list.shapes.map((shape, at) => (
              <Shape key={at} shape={shape} />
            ))}
          </svg>
          <p className="text-sm font-medium text-ink">{tile.label}</p>
          <p className="text-xs text-muted">{tile.generatorLabel}</p>
          {action?.(tile)}
        </li>
      ))}
    </ul>
  );
}
