import { ArrowRight, ChevronDown, Leaf } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Tag } from "@/components/ui/Chips";
import { EmptyState } from "@/components/ui/PageStates";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import type { ProductCardView } from "@/lib/products/cards";
import type { Category } from "@/lib/products/categories";
import type { DiscoverLink, Faq } from "@/lib/products/home";
import { categoryHref } from "@/lib/products/routes";
import { ProductRender } from "./ProductRender";
import { ProductGrid, ProductTile } from "./ProductTile";

/** The rows of the catalogue home (09 screen 10; prototype p01), top to bottom. */

const SECTION_TITLE = "text-h3 text-text";

/** One tile per category, a garment drawn on `soft`, the name under it. */
export function CategoryTiles({ categories, typeOf }: Readonly<{ categories: readonly Category[]; typeOf: (slug: string) => string | null }>) {
  return (
    <nav aria-label="Categories">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={categoryHref(category.slug)}
              className="flex h-full flex-col items-center gap-3 rounded-lg bg-soft px-3 pt-4 pb-3 text-small font-semibold text-text no-underline transition-shadow duration-fast ease-out hover:shadow-e2"
            >
              <span className="grid h-20 w-full place-items-center">
                <ProductRender typeId={typeOf(category.slug)} className="h-20 w-auto" />
              </span>
              <span>
                {category.label} <span className="font-medium text-muted">· {category.count}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The navy Studio Pro banner. It promises only what the rows hold: the factory's city and its smallest order. */
export function ProBanner({ lead, start, typeIds }: Readonly<{ lead: string; start: Route | null; typeIds: readonly (string | null)[] }>) {
  return (
    <section aria-labelledby="pro-banner" className="grid overflow-hidden rounded-2xl bg-navy text-on-dark md:grid-cols-2">
      <div className="flex flex-col items-start gap-4 p-8">
        <Tag tone="beta">Studio Pro</Tag>
        <h2 id="pro-banner" className="text-h1 text-gold">
          Club kits, made to order
        </h2>
        <p className="max-w-110 text-body-lg font-normal">{lead}</p>
        {start ? (
          <LinkButton href={start} variant="premium">
            Start designing
          </LinkButton>
        ) : null}
      </div>
      <div aria-hidden="true" className="hidden items-center justify-around gap-4 bg-electric p-6 md:flex">
        {typeIds.slice(0, 3).map((typeId, index) => (
          <span key={`${typeId}-${index}`} className="grid size-36 place-items-center">
            <ProductRender typeId={typeId} className="w-full" />
          </span>
        ))}
      </div>
    </section>
  );
}

/** A titled row of up to four cards with "View all". */
export function CardRow({ id, title, cards, viewAll }: Readonly<{ id: string; title: string; cards: readonly ProductCardView[]; viewAll: Route }>) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between gap-4">
        <h2 id={id} className={SECTION_TITLE}>
          {title}
        </h2>
        <Link href={viewAll} className="text-small text-muted hover:text-text">
          View all<span className="sr-only"> {title.toLowerCase()}</span>
        </Link>
      </header>
      {cards.length === 0 ? <p className="text-body text-muted">No base fits this row yet.</p> : <ProductGrid cards={cards} label={title} />}
    </section>
  );
}

/** The grey Eco band: the words on the left, up to three cards. Empty, it says no fabric is marked eco yet. */
export function EcoBand({ cards }: Readonly<{ cards: readonly ProductCardView[] }>) {
  return (
    <section aria-labelledby="eco-picks" className="grid gap-6 rounded-2xl bg-soft p-6 lg:grid-cols-[1fr_3fr]">
      <div className="flex flex-col justify-center gap-3">
        <h2 id="eco-picks" className="text-h2 text-text">
          Eco picks
        </h2>
        <p className="text-body text-text-2">Bases whose fabric the programme marks PFAS-free or lists with an OEKO-TEX certificate.</p>
      </div>
      {cards.length === 0 ? (
        <EmptyState icon={<Icon icon={Leaf} size={22} />} title="No eco fabric on file yet" className="py-6">
          A base shows here once its fabric&rsquo;s PFAS-free or OEKO-TEX column is filled in.
        </EmptyState>
      ) : (
        <ul aria-label="Eco picks" className="grid gap-4 sm:grid-cols-3">
          {cards.map((card) => (
            <li key={card.code} className="rounded-lg bg-bg p-3">
              <ProductTile card={card} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Discover({ links }: Readonly<{ links: readonly DiscoverLink[] }>) {
  return (
    <Titled id="discover" title="Discover more">
      <ul className="flex flex-wrap gap-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-body font-semibold text-text hover:bg-soft">
              {link.label}
              <Icon icon={ArrowRight} size={16} />
            </Link>
          </li>
        ))}
      </ul>
    </Titled>
  );
}

/** Questions, each a disclosure, answered from the rows. */
export function Questions({ faqs }: Readonly<{ faqs: readonly Faq[] }>) {
  return (
    <Titled id="questions" title="Questions">
      <div className="divide-y divide-border border-y border-border">
        {faqs.map((faq) => (
          <details key={faq.question} className="group">
            <summary className="flex h-14 cursor-pointer list-none items-center justify-between gap-4 text-body font-semibold text-text">
              {faq.question}
              <Icon icon={ChevronDown} size={20} className="text-muted transition-transform duration-fast group-open:rotate-180" />
            </summary>
            <p className="max-w-180 pb-4 text-body text-text-2">{faq.answer}</p>
          </details>
        ))}
      </div>
    </Titled>
  );
}

function Titled({ id, title, children }: Readonly<{ id: string; title: string; children: ReactNode }>) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className={SECTION_TITLE}>
        {title}
      </h2>
      {children}
    </section>
  );
}
