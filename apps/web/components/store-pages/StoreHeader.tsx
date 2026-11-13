import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { STORE_TABS, type StoreTab } from "@/lib/store-pages/routes";

/**
 * The head of the five Store tabs (prototype p14, p15, p17, p18; 09 screens 16, 24, 25): the page title with its
 * actions on the right, then the underline tabs Overview · Sales channels · Branding · Settings · Payouts. The tabs
 * are links, one page each, so the current one is `aria-current="page"` (10 §8 "Underline tabs").
 */
export function StoreHeader({ title, current, actions }: Readonly<{ title: string; current: StoreTab; actions?: ReactNode }>) {
  return (
    <header className="flex flex-col gap-5 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 text-text">{title}</h1>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      <nav aria-label="Store" className="flex items-center gap-6 overflow-x-auto border-b border-border">
        {STORE_TABS.map((tab) => {
          const on = tab.href === current;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={on ? "page" : undefined}
              className={cx(
                "relative -mb-px flex h-10 shrink-0 items-center border-b-2 text-body font-medium no-underline transition-colors duration-fast ease-out",
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
