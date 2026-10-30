import type { ArticleCardView } from "@/lib/home/catalogue-view";
import { ArticleCard } from "./ArticleCard";

/**
 * The grid of base articles (spec F-S4). The line above it says how many matched and where the
 * prices came from, so a placeholder ladder is never read as the factory's own quote.
 */
export function ArticleGrid({
  cards,
  total,
  factoryName,
}: Readonly<{ cards: readonly ArticleCardView[]; total: number; factoryName: string | null }>) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-[13px] text-muted" aria-live="polite">
        {total === 1 ? "1 base product" : `${total} base products`}
      </p>
      {cards.length === 0 ? (
        <p className="glass rounded-[1.5rem] p-6 text-[15px] text-ink-2">
          No base product matches those filters. Clear a filter, or look at the templates.
        </p>
      ) : (
        <ul aria-label="Base products" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <li key={card.code} className="relative">
              <ArticleCard card={card} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-[13px] text-muted">
        {factoryName === null
          ? "No factory prices could be read, so no price is shown."
          : `Prices are the placeholder ladder on file for ${factoryName}. None of them is a factory quote.`}
      </p>
    </div>
  );
}
