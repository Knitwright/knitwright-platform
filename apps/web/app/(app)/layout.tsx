import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Logo } from "@/components/brand/Logo";
import { SIGN_IN_PATH } from "@/lib/server/core/paths";
import { currentSession } from "@/lib/server/deps";

/** Everything under this layout needs a session. It is checked here on every request. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await currentSession();
  if (!session) redirect(SIGN_IN_PATH);

  return (
    <>
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5">
          <Link href="/studio" className="rounded-md">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted sm:inline" data-testid="account-email">
              {session.email}
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
