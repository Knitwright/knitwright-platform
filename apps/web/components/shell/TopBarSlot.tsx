"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/components/ui/cx";

/**
 * The centre of the top bar belongs to the page (09: "centre: page tabs, active tab underlined").
 * The layout draws the bar once; a page puts its title or its tabs into the bar's slot with
 * `TopBarTitle` or `TopBarTabs`, wherever in the page it renders them. On the server and before
 * hydration the slot is empty, and it fills as soon as the page is interactive.
 */

export const TOP_SLOT_ID = "shell-top-slot";

const noSubscription = () => () => undefined;

function TopBarSlot({ children }: Readonly<{ children: ReactNode }>) {
  const target = useSyncExternalStore(
    noSubscription,
    () => document.getElementById(TOP_SLOT_ID),
    () => null,
  );
  return target ? createPortal(children, target) : null;
}

/**
 * The page's title, centred in the top bar. It is drawn for the eye only: the page keeps its own h1
 * (hidden from the eye from `md` up), which is in the server's HTML and on a phone, where the bar has
 * no centre.
 */
export function TopBarTitle({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <TopBarSlot>
      <p aria-hidden="true" className="truncate text-title text-text">
        {children}
      </p>
    </TopBarSlot>
  );
}

export type TopBarTab = Readonly<{ href: Route; label: string; owns?: readonly string[] }>;

/** Whether a tab is the current one: its own address, or one of the prefixes it owns. */
export const tabIsCurrent = (tab: TopBarTab, path: string): boolean =>
  [tab.href as string, ...(tab.owns ?? [])].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/** The page's tabs, centred in the top bar; the current one is underlined (10 §8 "Tabs"). */
export function TopBarTabs({ label, tabs }: Readonly<{ label: string; tabs: readonly TopBarTab[] }>) {
  const path = usePathname();
  // The most specific tab wins, so "/ai-studio" is not current on "/ai-studio/agent".
  const current = [...tabs].filter((tab) => tabIsCurrent(tab, path)).sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <TopBarSlot>
      <nav aria-label={label} className="flex items-center gap-9">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab === current ? "page" : undefined}
            className={cx(
              "border-b-2 py-2 text-title whitespace-nowrap no-underline transition-colors duration-fast",
              tab === current ? "border-text text-text" : "border-transparent text-muted live:hover:text-text",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </TopBarSlot>
  );
}
