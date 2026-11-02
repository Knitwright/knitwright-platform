import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { GlassMenu } from "./GlassMenu";

/**
 * The account cluster of the top bar, as one menu (decision 0103). The address signed in, Settings
 * and Sign out stood in the row side by side and were the three things the row ran out of width
 * for: Sign out was last, so it was the control painted over the aurora, where muted text is
 * 3.35:1 and fails AA. They are the same three controls, in the bar's own glass panel.
 */

const ROW = "nav-pill flex min-h-10 items-center rounded-full px-4 text-[15px] text-ink-2 no-underline";

/** The rows themselves, shared by the account menu and the compact menu a phone gets. */
export function AccountRows({ email }: Readonly<{ email: string | null }>) {
  return (
    <>
      {email ? (
        <p className="truncate px-4 py-1 text-xs text-muted" data-testid="account-email">
          {email}
        </p>
      ) : null}
      {/* Settings has its own row rather than hiding behind the address: it once did, and nobody found it. */}
      <Link href="/settings" className={ROW}>
        Settings
      </Link>
      <SignOutButton />
    </>
  );
}

export function AccountMenu({ email }: Readonly<{ email: string | null }>) {
  return (
    <GlassMenu label="Account" panelLabel="Account" className="hidden lg:block">
      <AccountRows email={email} />
    </GlassMenu>
  );
}
