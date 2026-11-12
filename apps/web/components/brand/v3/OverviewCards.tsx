import type { Route } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/Chips";
import type { OverviewCard } from "@/lib/brand-studio/overview-cards";

/**
 * The Overview's cards (08 §4.6, d17): three to a row, each a part of the brand with its count pill,
 * opening its tab. The Colours card draws the first palette as a bar; the colours are the brand's own
 * data, so they are styles from the record, not tokens.
 */
export function OverviewCards({ cards }: Readonly<{ cards: readonly OverviewCard[] }>) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="brand-overview-cards">
      {cards.map((card) => (
        <li key={card.tab} className="relative flex min-h-31 flex-col gap-3 rounded-2xl border border-border bg-bg p-5 live:hover:shadow-e2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-title text-text">
              <Link href={`/brand?tab=${card.tab}` as Route} className="no-underline after:absolute after:inset-0 after:content-['']">
                {card.title}
              </Link>
            </h3>
            {card.pill ? <Badge tone="neutral">{card.pill}</Badge> : null}
          </div>
          {card.swatches.length > 0 ? (
            <div className="flex h-8 overflow-hidden rounded-sm border border-border" aria-hidden="true">
              {card.swatches.map((hex, index) => (
                <span key={`${hex}-${index}`} className="flex-1" style={{ backgroundColor: hex }} />
              ))}
            </div>
          ) : null}
          {card.chips.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {card.chips.map((chip) => (
                <li key={chip} className="rounded-full border border-border px-3 py-1 text-small text-text">
                  {chip}
                </li>
              ))}
            </ul>
          ) : null}
          {card.line ? <p className="text-body text-muted">{card.line}</p> : null}
        </li>
      ))}
    </ul>
  );
}
