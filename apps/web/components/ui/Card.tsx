import { Heart } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "./Chips";
import { cx } from "./cx";
import { Icon } from "./Icon";

/**
 * Cards (docs/spec/10-design-system.md §8 "Cards"). Pictures are passed in as `thumb`; a card
 * never fetches. Long titles truncate with an ellipsis and keep the full text as a title (§11).
 */

/** Order / info card: white, 1 px border, r-xl, 20 px padding, 18 px gap; a title with a right-aligned meta line. */
export function InfoCard({
  title,
  meta,
  children,
  className,
}: Readonly<{ title: ReactNode; meta?: ReactNode; children?: ReactNode; className?: string }>) {
  return (
    <section className={cx("flex flex-col gap-4.5 rounded-xl border border-border bg-bg p-5", className)}>
      <header className="flex items-baseline justify-between gap-4">
        <h3 className="text-title text-text">{title}</h3>
        {meta ? <span className="text-small text-muted">{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}

/** Panel section: a `soft` fill, r-xl, 12 px padding; a 13/600 header with a "Show all" link. */
export function PanelSection({
  title,
  action,
  children,
  className,
}: Readonly<{ title: string; action?: ReactNode; children: ReactNode; className?: string }>) {
  return (
    <section className={cx("flex flex-col gap-3 rounded-xl bg-soft p-3", className)}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-small font-semibold text-text">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

/** A template or mockup thumbnail: 116 × 136 px, r-md, 1 px border; hover lifts to e2 and shows Use and ♡. */
export function ThumbCard({
  name,
  thumb,
  onUse,
  onFavourite,
}: Readonly<{ name: string; thumb: ReactNode; onUse?: () => void; onFavourite?: () => void }>) {
  return (
    <figure className="group relative m-0 flex h-34 w-29 flex-col overflow-hidden rounded-md border border-border bg-bg transition-shadow duration-fast ease-out hover:shadow-e2 focus-within:shadow-e2">
      <div className="grid flex-1 place-items-center bg-soft">{thumb}</div>
      <figcaption className="truncate px-2 py-1 text-caption text-text-2" title={name}>
        {name}
      </figcaption>
      <div className="absolute inset-x-1.5 top-1.5 flex justify-between opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-within:opacity-100">
        <button type="button" onClick={onUse} className="h-7 rounded-btn-xs bg-navy px-2.5 text-caption font-semibold text-on-dark">
          Use<span className="sr-only"> {name}</span>
        </button>
        <button type="button" onClick={onFavourite} aria-label={`Save ${name}`} className="grid size-7 place-items-center rounded-btn-xs bg-bg text-text-2 shadow-e1">
          <Icon icon={Heart} size={16} />
        </button>
      </div>
    </figure>
  );
}

/** A project card: a 4:3 picture on `soft`, r-lg; the title 15/600 and "Edited 2 h ago"; a count badge top-left; ⋯ on hover. */
export function ProjectCard({
  title,
  meta,
  thumb,
  count,
  menu,
  href,
}: Readonly<{ title: string; meta: string; thumb: ReactNode; count?: number; menu?: ReactNode; href?: Route }>) {
  return (
    <article className="group relative flex min-w-0 flex-col gap-2">
      <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-soft">
        {thumb}
        {count !== undefined ? <Badge className="absolute top-2.5 left-2.5"># {count}</Badge> : null}
        {menu ? <div className="absolute top-2 right-2 z-10 opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-within:opacity-100">{menu}</div> : null}
      </div>
      <h3 className="truncate text-body-lg font-semibold text-text" title={title}>
        {href ? (
          <Link href={href} className="no-underline after:absolute after:inset-0 after:content-['']">
            {title}
          </Link>
        ) : (
          title
        )}
      </h3>
      <p className="-mt-1.5 text-small text-muted">{meta}</p>
    </article>
  );
}

/** A product card: a 1:1 picture on `soft`, r-lg; the name 15/600; "From £22" and the Studio Pro price in `ok`; decoration chips. */
export function ProductCard({
  name,
  thumb,
  price,
  proPrice,
  chips,
}: Readonly<{ name: string; thumb: ReactNode; price: string; proPrice?: string; chips?: ReactNode }>) {
  return (
    <article className="flex min-w-0 flex-col gap-2">
      <div className="grid aspect-square place-items-center overflow-hidden rounded-lg bg-soft">{thumb}</div>
      <h3 className="truncate text-body-lg font-semibold text-text" title={name}>
        {name}
      </h3>
      <p className="-mt-1.5 text-small text-text-2">
        {price}
        {proPrice ? <span className="ml-2 font-semibold text-ok">{proPrice}</span> : null}
      </p>
      {chips ? <div className="flex flex-wrap gap-1.5">{chips}</div> : null}
    </article>
  );
}
