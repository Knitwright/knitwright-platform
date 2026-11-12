import Link from "next/link";
import { StatusPill, Tag } from "@/components/ui/Chips";
import { cx } from "@/components/ui/cx";
import type { ProductCardView } from "@/lib/products/cards";
import { ProductRender } from "./ProductRender";

/**
 * A product card (10 §8 "Product card"; prototype p01): the render on a square `soft` tile with its badge, then the
 * name (the link), who makes it, the price, the Studio Pro price, and sizes · colours. A price that is not set reads
 * so in `muted`, never a number; the price's row label sits under it, so no figure reads as a factory quote.
 */
export function ProductTile({ card }: Readonly<{ card: ProductCardView }>) {
  return (
    <article className="group relative flex min-w-0 flex-col gap-1.5">
      <div className="relative grid aspect-square place-items-center overflow-hidden rounded-lg bg-soft transition-shadow duration-fast ease-out group-hover:shadow-e2">
        <ProductRender typeId={card.registryTypeId} />
        <div className="absolute bottom-3 left-3 flex gap-1.5">
          {card.badge ? <StatusPill tone={card.badge.tone}>{card.badge.label}</StatusPill> : null}
          <Tag>{card.classTag}</Tag>
        </div>
      </div>
      <h3 className="mt-1.5 truncate text-body-lg font-semibold text-text" title={card.name}>
        <Link href={card.href} className="no-underline after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-electric">
          {card.name}
        </Link>
      </h3>
      <p className="truncate text-caption text-muted">
        {card.maker} · <span className="font-mono">{card.code}</span>
      </p>
      <p className={cx("mt-1 text-body font-semibold", card.price.priced ? "text-text" : "text-muted")}>{card.price.line}</p>
      {card.price.label ? (
        <p className="truncate text-micro font-medium text-muted" title={card.price.label}>
          {card.price.label}
        </p>
      ) : null}
      {card.price.note ? <p className="text-micro font-medium text-warn">{card.price.note}</p> : null}
      <p className="text-caption text-muted">{card.proPrice}</p>
      <p className="text-caption text-muted">{card.spread}</p>
    </article>
  );
}

/** Cards in the 4-column grid of 10 §4 (2 on a phone, 3 on a tablet). */
export function ProductGrid({ cards, label }: Readonly<{ cards: readonly ProductCardView[]; label: string }>) {
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => (
        <li key={card.code} className="min-w-0">
          <ProductTile card={card} />
        </li>
      ))}
    </ul>
  );
}
