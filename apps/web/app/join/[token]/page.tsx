import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { pageFrame } from "@/components/shell/page-width";
import { SignupForm } from "@/components/signup/SignupForm";
import { brandChartSet } from "@/lib/charts/service";
import { PAGE_LEAD, PRIVACY_NOTE } from "@/lib/clubs/signup/fields";
import { loadSignupPage } from "@/lib/clubs/signup/public-load";
import { openSignup } from "@/lib/clubs/signup/service";
import { getEnv } from "@/lib/config/env";
import { adminClient, productionDeps } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * A player's sign-up link (spec F-T4, plan v5 Z7, decision 0087). A teenager on a phone with no
 * account opens it, types three things and is done. The page is never indexed, never stored by a
 * cache and never sends its address on (next.config.ts sets the headers).
 *
 * The token is the only key. Everything on the page is read for the club the token's link belongs
 * to: the club's name, the season's name, the sport's number range, the zone's name length and the
 * club's own size charts. No other player's answer, no roster, no design and no file.
 *
 * There is deliberately no `loading.tsx` in this folder: a loading file flushes the shell before
 * the page runs, and `notFound()` could then no longer set a 404, so a withdrawn link would answer
 * 200 (plan v5 Lessons).
 */
export const metadata: Metadata = {
  title: "Your kit details",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

const signupDeps = () => ({
  open: (token: string) => openSignup(adminClient(), token),
  charts: (brandId: string) => brandChartSet(adminClient(), brandId),
});

const TOO_MANY = "Too many requests from your network. Wait a minute, then reload the page.";

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  // Settings are read when the page is asked for, never when the app is built.
  await connection();
  const address = await productionDeps.getClientAddress();
  const allowed = await productionDeps.hitRateLimit(`${LIMITS.rosterSignupView.name}:address:${address}`, LIMITS.rosterSignupView);
  const { token } = await params;
  const loaded = allowed ? await loadSignupPage(signupDeps(), token) : null;
  if (allowed && !loaded) notFound();

  return (
    <>
      <PublicHeader linkHome={false} width="form" />
      <main id="main" className={`rise ${pageFrame("form")} flex flex-col gap-8 py-10`}>
        {loaded ? (
          <>
            <header className="flex flex-col gap-2">
              <p className="text-sm text-muted">{loaded.page.clubName}</p>
              <h1 className="text-3xl font-semibold tracking-tight text-ink" data-testid="signup-season-name">
                {loaded.page.seasonName}
              </h1>
              <p className="text-[15px] leading-relaxed text-ink-2">{PAGE_LEAD}</p>
            </header>
            <SignupForm token={token} page={loaded.page} siteKey={getEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
            <p className="text-sm text-muted">
              {PRIVACY_NOTE}{" "}
              <Link href="/legal/privacy" className="text-cobalt-soft underline-offset-4 hover:underline">
                Privacy notice
              </Link>
              .
            </p>
          </>
        ) : (
          <p role="alert" className="text-[15px] text-ink-2">
            {TOO_MANY}
          </p>
        )}
      </main>
    </>
  );
}
