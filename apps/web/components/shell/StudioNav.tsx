"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = Readonly<{ href: Route; label: string; matches: (path: string) => boolean }>;

/** The studio's sections. A section is current for its own page and the pages under it. */
export const STUDIO_SECTIONS: readonly NavItem[] = [
  {
    href: "/studio",
    label: "Designs",
    matches: (path) => (path === "/studio" || path.startsWith("/studio/")) && !path.startsWith("/studio/charts"),
  },
  { href: "/studio/charts", label: "Size charts", matches: (path) => path.startsWith("/studio/charts") },
  { href: "/club", label: "Club", matches: (path) => path === "/club" || path.startsWith("/club/") },
];

const PILL = "nav-pill rounded-full px-4 py-2 text-[15px] no-underline";

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
