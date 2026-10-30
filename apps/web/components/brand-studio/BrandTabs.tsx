import Link from "next/link";
import { BRAND_TABS, TAB_LABELS, type BrandTabName } from "@/lib/brand-studio/words";

/** The seven tabs of the brand page (spec F-S9), as links, so the page keeps working without scripts. */
export function BrandTabs({ current }: Readonly<{ current: BrandTabName }>) {
  return (
    <nav aria-label="Brand" className="flex flex-wrap items-center gap-1.5">
      {BRAND_TABS.map((tab) => (
        <Link
          key={tab}
          href={tab === "overview" ? "/brand-studio" : { pathname: "/brand-studio", query: { tab } }}
          aria-current={tab === current ? "page" : undefined}
          className={`nav-pill flex min-h-10 items-center rounded-full px-4 text-[15px] no-underline ${
            tab === current ? "bg-white/12 text-white" : "text-muted"
          }`}
        >
          {TAB_LABELS[tab]}
        </Link>
      ))}
    </nav>
  );
}
