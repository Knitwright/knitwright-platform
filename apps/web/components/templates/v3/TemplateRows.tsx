import { ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { FeedItem } from "@/lib/templates/feed/items";
import type { FeedRow } from "@/lib/templates/feed/rows";
import { tabHref } from "@/lib/templates/feed/tabs";
import { FeedCard } from "./FeedCard";

/**
 * The Discover rows (09 screen 7): a title with its count and "›" to the tab with the rest, then a
 * carousel of square cards. The carousel is a list that scrolls sideways and snaps to a card; a
 * keyboard reaches every card's button with Tab, which scrolls it into view.
 */
export function TemplateRow({ row }: Readonly<{ row: FeedRow }>) {
  const headingId = `row-${row.id}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="flex items-baseline gap-2 text-h3 text-text">
        {row.more === null ? (
          <>
            {row.title}
            <span className="text-small text-muted">{row.total}</span>
          </>
        ) : (
          <Link href={tabHref(row.more) as Route} className="group inline-flex min-h-10 items-center gap-2 text-text no-underline">
            {row.title}
            <span className="inline-flex items-center text-small text-muted group-hover:text-text">
              {row.total}
              <Icon icon={ChevronRight} size={16} />
            </span>
          </Link>
        )}
      </h2>
      <ul aria-label={row.title} className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
        {row.items.map((item) => (
          <li key={item.id} className="w-48 shrink-0 snap-start">
            <FeedCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One tab, or a search, as a grid. */
export function TemplateGrid({ title, items }: Readonly<{ title: string; items: readonly FeedItem[] }>) {
  return (
    <section aria-labelledby="template-grid" className="flex flex-col gap-4">
      <h2 id="template-grid" className="flex items-baseline gap-2 text-h3 text-text">
        {title}
        <span className="text-small text-muted" aria-live="polite">
          {items.length === 1 ? "1 template" : `${items.length} templates`}
        </span>
      </h2>
      <ul aria-label="Templates" className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
        {items.map((item) => (
          <li key={item.id}>
            <FeedCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
