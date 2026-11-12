import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { PRODUCTS_TABS, type ProductsTab } from "@/lib/products/routes";

/**
 * The head of the four Products tabs (prototype p01, p05, p08): the page title with its actions on the right, then
 * the underline tabs Catalogue · My products · Trending ideas · Fabrics. The tabs are links, one page each, so the
 * current one is `aria-current="page"` (10 §8 "Underline tabs").
 */
export function ProductsHeader({ title, current, actions }: Readonly<{ title: string; current: ProductsTab; actions?: ReactNode }>) {
  return (
    <header className="flex flex-col gap-5 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 text-text">{title}</h1>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      <nav aria-label="Products" className="flex items-center gap-6 border-b border-border">
        {PRODUCTS_TABS.map((tab) => {
          const on = tab.href === current;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={on ? "page" : undefined}
              className={cx(
                "relative -mb-px flex h-10 items-center border-b-2 text-body font-medium no-underline transition-colors duration-fast ease-out",
                on ? "border-navy text-text" : "border-transparent text-muted hover:text-text",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
