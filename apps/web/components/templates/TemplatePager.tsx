import type { Route } from "next";
import Link from "next/link";
import { pageMarks } from "@/lib/pagination/pages";
import { filterHref, type TemplateFilters } from "@/lib/templates/filters";

type PagerProps = Readonly<{ path: string; filters: TemplateFilters; page: number; totalPages: number }>;

const PILL = "nav-pill grid h-10 min-w-10 place-items-center rounded-full px-3 font-mono text-[13px] no-underline";

/** Page pills for the library. Unlike the studio's, each link keeps the filters in the address. */
export function TemplatePager({ path, filters, page, totalPages }: PagerProps) {
  if (totalPages <= 1) return null;
  const href = (to: number) => filterHref(path, filters, to) as Route;
  return (
    <nav aria-label="Pages of templates" className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={`${PILL} text-ink`}>
          Previous
        </Link>
      ) : null}
      <ol className="flex items-center gap-1.5">
        {pageMarks(page, totalPages).map((mark, index) =>
          mark === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 font-mono text-[13px] text-faint">
              …
            </li>
          ) : (
            <li key={mark}>
              <Link
                href={href(mark)}
                aria-current={mark === page ? "page" : undefined}
                aria-label={`Page ${mark}`}
                className={mark === page ? `${PILL} bg-white text-[#0b0c0e] hover:bg-white hover:text-[#0b0c0e]` : `${PILL} text-ink`}
              >
                {mark}
              </Link>
            </li>
          ),
        )}
      </ol>
      {page < totalPages ? (
        <Link href={href(page + 1)} rel="next" className={`${PILL} text-ink`}>
          Next
        </Link>
      ) : null}
    </nav>
  );
}
