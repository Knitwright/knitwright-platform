import type { Route } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { shopPath } from "@/lib/storefront/host";

/**
 * The frame of a brand's public storefront (spec F-L5 "themed from the brand kit"): the brand's name, its first
 * brand colour as the accent, a link to the returns policy, and the line that says who sells (Knitwright UK as
 * merchant of record, spec decision 1). Outside the Kittl shell: a shopper has no account.
 */
export function ShopFrame({ name, slug, accent, children }: Readonly<{ name: string; slug: string; accent: string | null; children: ReactNode }>) {
  const style = accent ? ({ "--store-accent": accent } as CSSProperties) : undefined;
  return (
    <div className="flex min-h-dvh flex-col bg-bg" style={style}>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-300 items-center justify-between gap-4 px-6 py-4">
          <Link href={shopPath(slug) as Route} className="flex items-center gap-3 text-h3 text-text no-underline">
            <span aria-hidden="true" className="size-4 rounded-full bg-[var(--store-accent,var(--color-navy))]" />
            {name}
          </Link>
          <nav aria-label="Storefront" className="flex items-center gap-4 text-body">
            <Link href={shopPath(slug) as Route} className="text-text-2">Shop</Link>
            <Link href={shopPath(slug, "/returns") as Route} className="text-text-2">Returns</Link>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-300 flex-1 flex-col gap-6 px-6 py-8">
        {children}
      </main>
      <footer className="border-t border-border">
        <p className="mx-auto max-w-300 px-6 py-4 text-caption text-muted">
          Made to order by Knitwright. Sold by Knitwright Ltd (UK) as merchant of record; payments by Stripe.
        </p>
      </footer>
    </div>
  );
}
