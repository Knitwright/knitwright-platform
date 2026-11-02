import Link from "next/link";
import { BRAND_TABS, TAB_LABELS, type BrandTabName } from "@/lib/brand-studio/words";

const PILL = "nav-pill flex min-h-10 items-center rounded-full border px-4 text-[15px] no-underline";

/**
 * The seven tabs of the brand page (spec F-S9), as links, so the page keeps working without scripts.
 *
 * EVERY TAB CARRIES ITS OWN SURFACE. The strip sits straight on the page, not inside the header's
 * glass, so whatever the aurora is doing behind it decides the contrast. On a phone the strip wraps
 * and the last tabs land under the aurora's pale blob, where `text-muted` measured 3.83:1 — below
 * AA, and the accessibility scan of this page said so. On `bg-surface` the same text is about 6:1
 * wherever the strip falls. A pale wash would have made it worse, not better: the light behind it is
 * what raises the background. The shape follows `components/studio/home/CatalogueNav.tsx`.
 */
export function BrandTabs({ current }: Readonly<{ current: BrandTabName }>) {
  return (
    <nav aria-label="Brand" className="flex flex-wrap items-center gap-1.5">
      {BRAND_TABS.map((tab) => (
        <Link
          key={tab}
          href={tab === "overview" ? "/brand-studio" : { pathname: "/brand-studio", query: { tab } }}
          aria-current={tab === current ? "page" : undefined}
          className={`${PILL} ${tab === current ? "border-white/25 bg-white/12 text-white" : "border-hairline bg-surface text-muted"}`}
        >
          {TAB_LABELS[tab]}
        </Link>
      ))}
    </nav>
  );
}
