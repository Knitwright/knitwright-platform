import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Logo } from "@/components/brand/Logo";
import { requireMember } from "@/lib/server/page-guards";

/**
 * The frame of the studio. It checks the session and the brand, and so does every
 * page inside it: the framework does not run this layout again when the user moves
 * from one of those pages to another.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { email, brand } = await requireMember();

  return (
    <>
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/studio" className="shrink-0 rounded-md">
              <Logo />
            </Link>
            <Link
              href="/brands"
              className="truncate rounded-md border border-hairline px-2.5 py-1 text-sm text-ink-2 transition-colors hover:bg-shell"
            >
              <span className="sr-only">Brand: {brand.name}. Change brand.</span>
              <span aria-hidden="true" data-testid="active-brand">
                {brand.name}
              </span>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/settings"
              className="hidden text-sm text-muted hover:text-ink sm:inline"
              data-testid="account-email"
            >
              {email}
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">
        {children}
      </main>
    </>
  );
}
