import Link from "next/link";
import { JourneyChip } from "@/components/ui/JourneyChip";
import type { HomeCard } from "@/lib/home/load";

/** A plain garment outline, for a design whose garment has no drawing. */
function GarmentOutline() {
  return (
    <svg className="lift-art" width="96" height="104" viewBox="0 0 96 104" aria-hidden="true" focusable="false">
      <path
        d="M30 4 L18 8 L2 30 L16 40 L22 32 L22 100 L74 100 L74 32 L80 40 L94 30 L78 8 L66 4 Q48 18 30 4 Z"
        fill="rgba(233,234,238,0.08)"
        stroke="rgba(255,255,255,0.4)"
      />
      <path d="M30 4 Q48 18 66 4" fill="none" stroke="var(--cobalt-soft)" strokeWidth="4" />
    </svg>
  );
}

/**
 * One design on the studio home: the front of its drawing, its name and garment, the step it has
 * reached, and when it was last changed. The whole glass card opens the design.
 */
export function DesignCard({ card }: Readonly<{ card: HomeCard }>) {
  const details = [card.styleNumber && `Style ${card.styleNumber}`, card.season].filter(Boolean).join(", ");

  return (
    <Link
      href={`/studio/${card.id}`}
      className="glass lift flex h-full flex-col overflow-hidden rounded-[2rem] text-ink no-underline"
      data-testid="design-card"
    >
      <span className="dot-grid grid h-32 place-items-center sm:h-40 border-b border-white/8 p-4">
        {card.thumbnail ? (
          // A data address made on the server, shown as a picture so nothing in it can run. The card names the design, so the drawing is decoration.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.thumbnail.src} alt="" className="lift-art h-24 w-auto sm:h-32 max-w-full object-contain" />
        ) : (
          <GarmentOutline />
        )}
      </span>
      <span className="lift-caption flex flex-1 flex-col gap-1.5 px-5 pb-5 pt-4">
        <span className="text-[15.5px] font-medium leading-snug">{card.name}</span>
        <span className="text-[13px] text-ink-2">{card.garmentLabel}</span>
        {details ? <span className="text-[13px] text-muted">{details}</span> : null}
        <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-muted">
          <JourneyChip step={card.step} />
          <span>
            <span className="sr-only">Changed </span>
            {card.changed}
          </span>
        </span>
      </span>
    </Link>
  );
}
