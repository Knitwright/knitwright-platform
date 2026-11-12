import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/**
 * Underline tabs that are links (10 §8 "Tabs, underline"), for a page whose tabs each have their own
 * address, so it works without scripts and a tab can be shared. The chosen tab is `text` with a 2 px
 * navy underline; the rest are `muted`. Team and Brand use it (decision 0144).
 */

export type LinkTab = Readonly<{ id: string; href: Route; label: ReactNode }>;

export function LinkTabs({ tabs, current, label, className }: Readonly<{ tabs: readonly LinkTab[]; current: string; label: string; className?: string }>) {
  return (
    <nav aria-label={label} className={cx("flex items-center gap-6 overflow-x-auto border-b border-border", className)}>
      {tabs.map((tab) => {
        const on = tab.id === current;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={cx(
              "-mb-px flex h-11 shrink-0 items-center border-b-2 text-body-lg font-semibold whitespace-nowrap no-underline transition-colors duration-fast",
              on ? "border-navy text-text" : "border-transparent text-muted live:hover:text-text",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
