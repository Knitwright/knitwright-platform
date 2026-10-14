"use client";

import { useRef } from "react";
import type { ImportView } from "@/lib/design-import/view-model";

type Props = Readonly<{
  view: ImportView;
  /** Landmarks dragged since the last fit, as fractions of the picture. */
  moved: Readonly<Record<string, Readonly<Record<string, { x: number; y: number }>> | undefined>>;
  onMove: (view: "front" | "back", id: string, x: number, y: number) => void;
  disabled: boolean;
}>;

/** Your picture with the outline we found and the landmarks as handles you can drag. A moved landmark is used when you redo the fit. */
export function PictureOverlay({ view, moved, onMove, disabled }: Props) {
  const box = useRef<SVGSVGElement>(null);
  const drag = useRef<{ view: "front" | "back"; id: string } | null>(null);

  const fraction = (event: React.PointerEvent): { x: number; y: number } | null => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };

  return (
    <figure className="m-0 rounded-xl border border-hairline bg-white p-2" data-testid="design-import-picture">
      <div className="relative mx-auto w-full max-w-[28rem]">
        {/* The person's own picture, served by the files route; next/image adds nothing for it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={view.pictureUrl} alt="Your picture" className="block h-auto w-full" />
        <svg
          ref={box}
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full touch-none"
          onPointerMove={(event) => {
            const at = drag.current && fraction(event);
            if (drag.current && at) onMove(drag.current.view, drag.current.id, at.x, at.y);
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerLeave={() => (drag.current = null)}
        >
          {view.overlay.views.map((entry) => (
            <g key={entry.view}>
              <polygon points={entry.outline.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#2563eb" strokeWidth="0.004" vectorEffect="non-scaling-stroke" />
              {entry.landmarks.map((mark) => {
                const body = entry.view === "front" || entry.view === "back" ? entry.view : null;
                const at = (body && moved[body]?.[mark.id]) || { x: mark.x, y: mark.y };
                return (
                  <circle
                    key={mark.id}
                    cx={at.x}
                    cy={at.y}
                    r={0.012}
                    fill={mark.source === "moved" ? "#16a34a" : "#f59e0b"}
                    stroke="#fff"
                    strokeWidth="0.003"
                    className={disabled ? "" : "cursor-grab"}
                    aria-label={`${mark.id} on the ${entry.view}`}
                    onPointerDown={(event) => {
                      if (disabled || !body) return;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      drag.current = { view: body, id: mark.id };
                    }}
                  />
                );
              })}
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="mt-1 text-center text-sm text-[#4b4f58]">Your picture, with the outline and landmarks we found. Drag a landmark that is in the wrong place.</figcaption>
    </figure>
  );
}
