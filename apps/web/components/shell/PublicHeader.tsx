import Link from "next/link";
import type { ReactNode } from "react";
import { PRODUCT } from "@/lib/config/product";
import { BrandMark } from "@/components/brand/Logo";
import { PAGE_WIDTH, type PageWidth } from "./page-width";

type PublicHeaderProps = Readonly<{
  /** Links on the right of the pill. */
  children?: ReactNode;
  /** When false, the mark is not a link (a shared design is not an entry to the site). */
  linkHome?: boolean;
  width?: PageWidth;
}>;

/** The floating glass pill on the pages anyone can open. */
export function PublicHeader({ children, linkHome = true, width = "content" }: PublicHeaderProps) {
  const mark = (
    <>
      <BrandMark />
      <span className="text-[19px] font-medium tracking-[-0.02em]">{PRODUCT.name}</span>
    </>
  );
  return (
    <div className={`mx-auto w-full ${PAGE_WIDTH[width]} px-3 pt-4 sm:px-5`}>
      <header className="glass-strong rise flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[2rem] py-3 pl-6 pr-3 sm:rounded-full">
        {linkHome ? (
          <Link href="/" className="flex items-center gap-2.5 rounded-full text-white">
            {mark}
          </Link>
        ) : (
          <span className="flex items-center gap-2.5 text-white">{mark}</span>
        )}
        {children}
      </header>
    </div>
  );
}
