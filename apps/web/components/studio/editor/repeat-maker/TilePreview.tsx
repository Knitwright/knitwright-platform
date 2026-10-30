import type { RepeatPreview } from "@/lib/repeat";

/**
 * The repeat laid out, and the tile's own bounds on top of it (spec F-S4 "tile bounds"). Drawn from
 * `lib/repeat`'s own answer about where each tile goes, so the preview and the published tile can
 * never disagree about the layout.
 */

const shapeFill = (shape: string | null): string => (shape === "circle" ? "fill" : "rect");

export function TilePreview({ view, crossing }: Readonly<{ view: RepeatPreview; crossing: readonly string[] }>) {
  const { tile, area } = view;
  return (
    <svg
      viewBox={`0 0 ${area.widthTenths} ${area.heightTenths}`}
      role="img"
      aria-label="How the repeat lays out"
      data-testid="repeat-preview"
      data-tiles={view.tiles.length}
      className="aspect-square w-full rounded-2xl border border-white/10"
    >
      <rect x="0" y="0" width={area.widthTenths} height={area.heightTenths} fill={view.background} />
      <defs>
        <clipPath id="repeat-tile-clip">
          <rect x="0" y="0" width={tile.widthTenths} height={tile.heightTenths} />
        </clipPath>
      </defs>
      {view.tiles.map((placed) => (
        <g
          key={`${placed.column}:${placed.row}`}
          transform={`translate(${placed.xTenths + (placed.flipX ? tile.widthTenths : 0)} ${placed.yTenths + (placed.flipY ? tile.heightTenths : 0)}) scale(${placed.flipX ? -1 : 1} ${placed.flipY ? -1 : 1})`}
        >
          <g clipPath="url(#repeat-tile-clip)">
            {view.draws.map((draw) =>
              shapeFill(draw.shape) === "fill" ? (
                <ellipse
                  key={`${draw.layerId}-${draw.copy}`}
                  cx={draw.leftTenths + draw.widthTenths / 2}
                  cy={draw.topTenths + draw.heightTenths / 2}
                  rx={draw.widthTenths / 2}
                  ry={draw.heightTenths / 2}
                  fill={draw.colour}
                  transform={draw.rotationDeg === 0 ? undefined : `rotate(${draw.rotationDeg} ${draw.leftTenths + draw.widthTenths / 2} ${draw.topTenths + draw.heightTenths / 2})`}
                />
              ) : (
                <rect
                  key={`${draw.layerId}-${draw.copy}`}
                  x={draw.leftTenths}
                  y={draw.shape === "stripe" ? draw.topTenths + draw.heightTenths * 0.3 : draw.topTenths}
                  width={draw.widthTenths}
                  height={draw.shape === "stripe" ? draw.heightTenths * 0.4 : draw.heightTenths}
                  fill={draw.colour}
                  opacity={draw.artworkId === null ? 1 : 0.55}
                  transform={draw.rotationDeg === 0 ? undefined : `rotate(${draw.rotationDeg} ${draw.leftTenths + draw.widthTenths / 2} ${draw.topTenths + draw.heightTenths / 2})`}
                />
              ),
            )}
          </g>
        </g>
      ))}
      {/* The tile's bounds: the one tile the person is working inside. */}
      <rect
        x="0"
        y="0"
        width={tile.widthTenths}
        height={tile.heightTenths}
        fill="none"
        stroke={crossing.length > 0 ? "#f0b429" : "#ffffff"}
        strokeOpacity="0.8"
        strokeWidth={Math.max(2, tile.widthTenths / 200)}
        strokeDasharray={`${tile.widthTenths / 25} ${tile.widthTenths / 50}`}
        data-testid="repeat-tile-bounds"
      />
    </svg>
  );
}
