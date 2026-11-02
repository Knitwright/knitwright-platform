import Link from "next/link";
import type { ReactNode } from "react";
import { BrandCompletionPill } from "@/components/brand-studio/BrandCompletionPill";
import { BrandMark } from "@/components/brand/Logo";
import { PRODUCT } from "@/lib/config/product";
import { AccountMenu, AccountRows } from "./AccountMenu";
import { GlassMenu } from "./GlassMenu";
import { PAGE_WIDTH } from "./page-width";
import { StudioNav } from "./StudioNav";

type StudioHeaderProps = Readonly<{ email: string | null; brandName: string; credits?: ReactNode }>;

/**
 * The floating glass pill at the top of the studio: the mark and the name, the sections, the brand
 * being worked on and the account.
 *
 * THE ROW GREW BY MENU, NOT BY WIDTH (decision 0102). The pill is still held to the page width
 * (`PAGE_WIDTH.content`), which is 1110 px of room at every desktop size, so a wider screen gives
 * it nothing. What changed is that the row no longer holds one control per thing it offers:
 *
 * - The account cluster (the address, Settings, Sign out) is one `Account` menu.
 * - Only the first four sections are pills; `StudioNav`'s "More" menu holds the rest.
 *
 * That took the sections from 625 px to 389 px and the account cluster from three controls to one,
 * which is what pays for the name beside the mark, for Launch and Teamwear, and for the sections
 * still waiting. A section in the menu costs the row nothing at all.
 *
 * The compact layout — one `Menu` holding every section and the account rows — is what a phone has
 * always had. It now runs to 1024 px rather than 768 px, because the bar overflowed its glass by
 * 79 px at 1024 and by 335 px at 768 and nothing in it had ever been measured between those widths.
 * `headerFits` in `e2e/brand-studio.spec.ts` measures every width the bar now supports.
 */
export function StudioHeader({ email, brandName, credits }: StudioHeaderProps) {
  return (
    <div className={`sticky top-3 z-40 mx-auto w-full ${PAGE_WIDTH.content} px-3 pt-3 sm:px-5`}>
      <header className="glass-strong rise flex h-16 items-center gap-1 rounded-full pl-3 pr-2 sm:gap-3 sm:pl-6">
        {/*
          `min-w-10` keeps the mark a 40 px target on a phone, where the name beside it is for
          screen readers only and the mark's own drawing is 24 px wide: without it `mobile.spec.ts`
          measures this link at 24 by 40 and fails on every signed-in page at once.
        */}
        <Link href="/studio" className="flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-2.5 rounded-full text-white no-underline">
          <BrandMark />
          {/* On a phone the row has no room for the name, so there it is for screen readers only. */}
          <span className="text-[19px] font-medium tracking-[-0.02em] max-sm:sr-only">{PRODUCT.name}</span>
        </Link>
        <div className="hidden lg:block">
          <StudioNav />
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          <Link
            href="/brands"
            className="nav-pill min-w-10 truncate rounded-full border border-white/12 px-3.5 py-2.5 text-sm text-ink-2"
          >
            <span className="sr-only">Brand: {brandName}. Change brand.</span>
            <span aria-hidden="true" data-testid="active-brand">
              {brandName}
            </span>
          </Link>
          <BrandCompletionPill />
          {credits}
          <AccountMenu email={email} />
          <GlassMenu label="Menu" panelLabel="Studio menu" className="lg:hidden">
            <StudioNav stacked />
            <div className="my-1 h-px bg-white/10" aria-hidden="true" />
            <AccountRows email={email} />
          </GlassMenu>
        </div>
      </header>
    </div>
  );
}
