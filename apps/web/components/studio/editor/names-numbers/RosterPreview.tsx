import type { MarkPreview } from "./preview";

/**
 * The preview roster entry shown on the 3D view (spec F-S4). It draws the sample name over the
 * sample number in the chosen colour, with its outline where one was given as a colour, and says
 * underneath that it is not drawn to the finished size.
 */

const LETTER_STROKE = 2;

export function RosterPreview({ view }: Readonly<{ view: MarkPreview }>) {
  return (
    <figure className="flex flex-col gap-2" data-testid="names-numbers-preview" data-roster={view.roster}>
      <svg viewBox="0 0 240 180" role="img" aria-label={`Preview of ${view.roster} on the back`} className="h-44 w-full rounded-2xl bg-tile-2/60">
        {/* The back of the shirt, as a shape only: the 3D view draws the garment itself. */}
        <path d="M60 18 L90 10 L120 24 L150 10 L180 18 L188 56 L170 60 L170 170 L70 170 L70 60 L52 56 Z" fill="currentColor" className="text-white/[0.06]" stroke="currentColor" strokeWidth="1" />
        <text
          x="120"
          y="64"
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          letterSpacing="2"
          fill={view.fill}
          stroke={view.outlineFill ?? "none"}
          strokeWidth={view.outlineFill ? LETTER_STROKE : 0}
          paintOrder="stroke"
        >
          {view.sampleName}
        </text>
        <text
          x="120"
          y="140"
          textAnchor="middle"
          fontSize="64"
          fontWeight="700"
          fill={view.fill}
          stroke={view.outlineFill ?? "none"}
          strokeWidth={view.outlineFill ? LETTER_STROKE * 2 : 0}
          paintOrder="stroke"
        >
          {view.sampleNumber}
        </text>
      </svg>
      <figcaption className="flex flex-col gap-1 text-[13px] text-chalk-muted">
        <span>{view.note}</span>
        {view.outlineWords ? <span data-testid="names-numbers-outline-words">Outline: {view.outlineWords}. The factory matches it.</span> : null}
        {view.zones.length === 0 ? (
          <span>No zone is chosen yet, so nothing goes on the garment.</span>
        ) : (
          <span>On: {view.zones.map((zone) => zone.label).join(", ")}.</span>
        )}
      </figcaption>
    </figure>
  );
}
