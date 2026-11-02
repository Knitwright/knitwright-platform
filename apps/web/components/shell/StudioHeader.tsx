import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { BrandCompletionPill } from "@/components/brand-studio/BrandCompletionPill";
import { BrandMark } from "@/components/brand/Logo";
import { PRODUCT } from "@/lib/config/product";
import { PAGE_WIDTH } from "./page-width";
import { PhoneMenu } from "./PhoneMenu";
import { StudioNav } from "./StudioNav";

type StudioHeaderProps = Readonly<{ email: string | null; brandName: string; credits?: ReactNode }>;

/**
 * The floating glass pill at the top of the studio: the mark, the sections, the brand
 * being worked on and the account. On a phone the sections, settings and sign out move
 * into a menu button.
 *
 * THE ROW IS AT ITS LIMIT, SO NOTHING IS ADDED TO IT WITHOUT TAKING SOMETHING OUT. The pill is
 * held to the page width (`PAGE_WIDTH.content`), which is 1110 px of room at every desktop size,
 * and the sections alone take 625 px of it. Measured at 1280 by 720 with the sections, the brand,
 * the credits, Settings and Sign out all shown, the row ran 39 px past the glass before Brand
 * Studio's completion pill and 102 px past it after. What hangs outside the glass is drawn over
 * the aurora instead, and `text-muted` on the aurora is 3.35:1, which fails WCAG AA: that is the
 * colour-contrast fault the end-to-end accessibility scans of /studio, /catalogue, /templates and
 * the guided flow report, and it names Sign out because Sign out is last in the row.
 *
 * So the product name is for screen readers only and the groups sit three apart rather than six,
 * which together buy 106 px and leave the row 43 px roomier than it was. The mark stays as the
 * visible way home. Decision 0079 records this and asks the owner whether the sections should move
 * into an overflow menu, which is the only change that makes real room.
 */
export function StudioHeader({ email, brandName, credits }: StudioHeaderProps) {
  return (
    <div className={`sticky top-3 z-40 mx-auto w-full ${PAGE_WIDTH.content} px-3 pt-3 sm:px-5`}>
      <header className="glass-strong rise flex h-16 items-center gap-1 rounded-full pl-3 pr-2 sm:gap-3 sm:pl-6">
        <Link href="/studio" className="flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-2.5 rounded-full text-white">
          <BrandMark />
          <span className="sr-only">{PRODUCT.name}</span>
        </Link>
        <div className="hidden md:block">
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
          <span className="hidden max-w-56 truncate px-1 text-sm text-muted md:inline" data-testid="account-email">
            {email}
          </span>
          {/* Shown at every width, phones too: Settings was once reachable only through the email. */}
          <Link href="/settings" className="nav-pill inline-flex min-h-10 shrink-0 items-center rounded-full px-3.5 text-sm font-medium text-ink-2">
            Settings
          </Link>
          <div className="hidden md:block">
            <SignOutButton />
          </div>
          <PhoneMenu>
            <StudioNav stacked />
            <div className="my-1 h-px bg-white/10" aria-hidden="true" />
            {email ? <p className="truncate px-4 py-1 text-xs text-muted">{email}</p> : null}
            <SignOutButton />
          </PhoneMenu>
        </div>
      </header>
    </div>
  );
}
