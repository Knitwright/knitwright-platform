import { drawingOf } from "@/lib/design-import/drawing";
import type { ImportView } from "@/lib/design-import/view-model";

/** Our drawing of the reading, in the picture's proportions so the two line up. For looking at, not a print file. */
export function StackDrawing({ view }: Readonly<{ view: ImportView }>) {
  const drawing = drawingOf(view);
  return (
    <figure className="m-0 rounded-xl border border-hairline bg-white p-2" data-testid="design-import-drawing">
      <div className="relative mx-auto aspect-square w-full max-w-[28rem]">
        <svg viewBox="0 0 1 1" role="img" aria-label="Our drawing of the reading" className="size-full">
          {drawing.views.map((entry) => (
            <polygon key={entry.view} points={entry.points} fill={entry.fill} stroke="#1d2330" strokeWidth="0.003" />
          ))}
          {drawing.marks.map((mark) => (
            <g key={mark.layerId}>
              {mark.redrawn ? (
                <rect x={mark.x} y={mark.y} width={mark.w} height={mark.h} fill="none" stroke={mark.ink} strokeWidth="0.004" strokeDasharray="0.015 0.01" />
              ) : null}
              {mark.text ? (
                <text x={mark.x + mark.w / 2} y={mark.y + mark.h * 0.78} fontSize={mark.h * 0.9} textAnchor="middle" fill={mark.ink} fontFamily="sans-serif" fontWeight="700">
                  {mark.text}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="mt-1 text-center text-sm text-[#4b4f58]">Our drawing of the reading</figcaption>
    </figure>
  );
}
