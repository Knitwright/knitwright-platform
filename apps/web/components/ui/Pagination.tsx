import type { Route } from "next";
import Link from "next/link";
import { pageHref, pageMarks } from "@/lib/pagination/pages";

type PaginationProps = Readonly<{
  /** The list's own address, without a page number. */
  path: string;
  page: number;
  totalPages: number;
  /** Names the list for screen readers, as in "Pages of designs". */
  label: string;
}>;

const PILL = "nav-pill grid h-9 min-w-9 place-items-center rounded-full px-3 font-mono text-[13px] no-underline";

/** Glass page pills under a long list: Previous, the page numbers and Next. Hidden for a single page. */
export function Pagination({ path, page, totalPages, label }: PaginationProps) {
  if (totalPages <= 1) return null;
  const href = (to: number) => pageHref(path, to) as Route;

  return (
    <nav aria-label={label} className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={`${PILL} text-ink`}>
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={`${PILL} text-faint`}>
          Previous
        </span>
      )}
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
      ) : (
        <span aria-disabled="true" className={`${PILL} text-faint`}>
          Next
        </span>
      )}
    </nav>
  );
}
