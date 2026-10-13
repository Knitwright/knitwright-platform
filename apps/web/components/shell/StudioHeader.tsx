import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { BrandMark } from "@/components/brand/Logo";
import { PRODUCT } from "@/lib/config/product";
import { PhoneMenu } from "./PhoneMenu";
import { StudioNav } from "./StudioNav";

type StudioHeaderProps = Readonly<{ email: string | null; brandName: string }>;

/**
 * The floating glass pill at the top of the studio: the mark, the sections, the brand
 * being worked on and the account. On a phone the sections, settings and sign out move
 * into a menu button.
 */
export function StudioHeader({ email, brandName }: StudioHeaderProps) {
  return (
    <div className="sticky top-3 z-40 mx-auto w-full max-w-6xl px-3 pt-3 sm:px-5">
      <header className="glass-strong rise flex h-16 items-center gap-3 rounded-full pl-5 pr-2 sm:gap-6 sm:pl-6">
        <Link href="/studio" className="flex shrink-0 items-center gap-2.5 rounded-full text-white">
          <BrandMark />
          <span className="text-[19px] font-medium tracking-[-0.02em] max-sm:sr-only">{PRODUCT.name}</span>
        </Link>
        <div className="hidden md:block">
          <StudioNav />
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <Link
            href="/brands"
            className="nav-pill min-w-0 truncate rounded-full border border-white/12 px-3.5 py-1.5 text-sm text-ink-2"
          >
            <span className="sr-only">Brand: {brandName}. Change brand.</span>
            <span aria-hidden="true" data-testid="active-brand">
              {brandName}
            </span>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            <Link
              href="/settings"
              className="nav-pill max-w-56 truncate rounded-full px-3 py-1.5 text-sm text-muted"
              data-testid="account-email"
            >
              {email ?? "Settings"}
            </Link>
            <SignOutButton />
          </div>
          <PhoneMenu>
            <StudioNav stacked />
            <div className="my-1 h-px bg-white/10" aria-hidden="true" />
            <Link href="/settings" className="nav-pill rounded-full px-4 py-2 text-[15px] text-ink">
              Settings
              {email ? <span className="block truncate text-xs text-muted">{email}</span> : null}
            </Link>
            <SignOutButton />
          </PhoneMenu>
        </div>
      </header>
    </div>
  );
}
