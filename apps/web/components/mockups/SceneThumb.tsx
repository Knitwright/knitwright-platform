import type { MockupScene } from "@/lib/mockups";

/**
 * The little picture on a scene card.
 *
 * **It is a plan of the scene, not a picture of the kit**, and the card says so underneath. It is
 * drawn from the scene's own data: the backdrop colour the scene names, and one soft shape for each
 * garment slot where that slot sits. So it is honest about what it knows, it needs no render and no
 * network, it is the same every time, and it carries no third-party image -- which this repository
 * may not hold.
 */
export const THUMB_NOTE = "A plan of the scene, not a picture of your kit.";

const GARMENT_FILL = "rgba(255,255,255,0.78)";
const GARMENT_EDGE = "rgba(17,20,26,0.22)";

export function SceneThumb({ scene, ratio = 4 / 5 }: Readonly<{ scene: MockupScene; ratio?: number }>) {
  const width = 100;
  const height = Math.round(width / ratio);
  const gradient = scene.backdrop.hexTwo !== undefined;
  const id = `thumb-${scene.slug}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      // Decoration beside a card that already names the scene in words.
      aria-hidden="true"
      focusable="false"
      className="h-auto w-full rounded-xl border border-white/10"
      preserveAspectRatio="none"
    >
      {gradient ? (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={scene.backdrop.hex} />
            <stop offset="1" stopColor={scene.backdrop.hexTwo} />
          </linearGradient>
        </defs>
      ) : null}
      <rect width={width} height={height} fill={gradient ? `url(#${id})` : scene.backdrop.hex} />
      {scene.slots.map((slot) => (
        <rect
          key={slot.index}
          x={slot.frame.x * width}
          y={slot.frame.y * height}
          width={slot.frame.width * width}
          height={slot.frame.height * height}
          rx={Math.max(1, slot.frame.width * width * 0.12)}
          fill={GARMENT_FILL}
          stroke={GARMENT_EDGE}
          strokeWidth="0.6"
        />
      ))}
    </svg>
  );
}
