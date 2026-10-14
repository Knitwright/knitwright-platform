import Link from "next/link";
import type { ReactNode } from "react";
import type { ProjectSummary } from "@/lib/projects/service";

export interface CardBasics extends ProjectSummary {
  /** When it was last changed, in words. */
  readonly changed: string;
}

type DesignCardProps = Readonly<{
  card: CardBasics;
  /** The front of its drawing. It may arrive after the card. */
  art: ReactNode;
  /** The step it has reached. It may arrive after the card. */
  step: ReactNode;
}>;

/**
 * One design on the studio home: the front of its drawing, its name and garment, the step it has
 * reached, and when it was last changed. The whole glass card opens the design.
 */
export function DesignCard({ card, art, step }: DesignCardProps) {
  const details = [card.styleNumber && `Style ${card.styleNumber}`, card.season].filter(Boolean).join(", ");

  return (
    <Link
      href={`/studio/${card.id}`}
      className="glass lift flex h-full flex-col overflow-hidden rounded-[2rem] text-ink no-underline"
      data-testid="design-card"
    >
      <span className="dot-grid grid h-32 place-items-center sm:h-40 border-b border-white/8 p-4">{art}</span>
      <span className="lift-caption flex flex-1 flex-col gap-1.5 px-5 pb-5 pt-4">
        <span className="text-[15.5px] font-medium leading-snug">{card.name}</span>
        <span className="text-[13px] text-ink-2">{card.garmentLabel}</span>
        {details ? <span className="text-[13px] text-muted">{details}</span> : null}
        <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-muted">
          {step}
          <span>
            <span className="sr-only">Changed </span>
            {card.changed}
          </span>
        </span>
      </span>
    </Link>
  );
}
