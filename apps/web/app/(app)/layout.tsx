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
              data-testid="active-brand"
              className="truncate rounded-md border border-hairline px-2.5 py-1 text-sm text-ink-2 transition-colors hover:bg-shell"
            >
              {brand.name}
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-sm text-muted sm:inline" data-testid="account-email">
              {email}
            </span>
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
