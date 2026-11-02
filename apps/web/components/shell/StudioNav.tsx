"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = Readonly<{ href: Route; label: string; matches: (path: string) => boolean }>;

/** The studio's sections. A section is current for its own page and the pages under it. */
const STUDIO_SECTIONS: readonly NavItem[] = [
  {
    href: "/studio",
    label: "Designs",
    matches: (path) => (path === "/studio" || path.startsWith("/studio/")) && !path.startsWith("/studio/charts"),
  },
  // Teamwear has no entry here on purpose, and the reason is measured rather than guessed.
  //
  // This bar is capped at PAGE_WIDTH.content (max-w-6xl, 1110px) at every desktop width, and these
  // section pills already take about 625px of it, so it is structurally over capacity. Its content
  // overflows the glass pill, which paints the last control of the row over the aurora rather than
  // over glass-strong, and muted text on the aurora fails AA. A teamwear section costs about 90px
  // and so re-breaks that for every workstream, including after the shared fix lands.
  //
  // The shared chrome fault is owned by pull request #101; this file is not Z5's to change. The
  // owner is deciding how the bar handles growth (an overflow menu, or collapsing the account
  // cluster). Until that lands a new section takes width from another workstream, so teamwear is
  // reached by its own routes and links instead. Owner question 8 of decision 0086, pull #120.
  { href: "/templates", label: "Templates", matches: (path) => path.startsWith("/templates") },
  { href: "/catalogue", label: "Catalogue", matches: (path) => path.startsWith("/catalogue") },
  { href: "/studio/charts", label: "Size charts", matches: (path) => path.startsWith("/studio/charts") },
  { href: "/designer", label: "Designer", matches: (path) => path.startsWith("/designer") },
  { href: "/club", label: "Club", matches: (path) => path === "/club" || path.startsWith("/club/") },
  { href: "/brand", label: "Brand", matches: (path) => path === "/brand" || path.startsWith("/brand/") },
];

const PILL = "nav-pill flex min-h-10 items-center rounded-full px-4 text-[15px] no-underline";

/** The section links, as pills. `stacked` lays them out for the phone menu. */
export function StudioNav({ stacked = false }: Readonly<{ stacked?: boolean }>) {
  const path = usePathname();

  return (
    <nav aria-label="Studio" className={stacked ? "flex flex-col gap-1" : "flex items-center gap-1"}>
      {STUDIO_SECTIONS.map((item) => {
        const current = item.matches(path);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`${PILL} ${current ? "bg-white/12 text-white" : "text-muted"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
