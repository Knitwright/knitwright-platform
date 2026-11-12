import type { Route } from "next";
import Link from "next/link";
import { cx } from "@/components/ui/cx";
import { ORDERS_TABS } from "@/lib/shell/tabs";

/**
 * Orders · Samples · Collection plans · Quotes (09 screen 15), under the banner as in p09. Each tab is
 * its own address, so they are links: the current one carries `aria-current` and the 2 px navy
 * underline of 10 §8's underline tabs.
 */
export function OrdersTabs({ current }: Readonly<{ current: Route }>) {
  return (
    <nav aria-label="Orders" className="flex items-center gap-6 border-b border-border">
      {ORDERS_TABS.map((tab) => {
        const on = tab.href === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={cx(
              "-mb-px flex h-10 items-center border-b-2 text-body-lg no-underline transition-colors duration-fast",
              on ? "border-navy font-semibold text-text" : "border-transparent text-muted live:hover:text-text",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
