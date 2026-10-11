import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Logo } from "@/components/brand/Logo";
import { ResponseForm } from "@/components/share/ResponseForm";
import { SharedDesign } from "@/components/share/SharedDesign";
import { brandChartSet } from "@/lib/charts/service";
import { getEnv } from "@/lib/config/env";
import { adminClient, productionDeps } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { loadSharePage } from "@/lib/share/public-load";
import { openShare } from "@/lib/share/service";
import { createFileReader } from "@/lib/storage/read";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";

/**
 * A design shared with people who have no account (decision 0026). Anyone holding the link may see
 * it, so the page is never indexed, never stored by a cache and never sends its address on
 * (next.config.ts sets the headers). An unknown, expired or revoked link is the ordinary page that
 * does not exist, with nothing to tell the three apart.
 */
export const metadata: Metadata = {
  title: "Shared design",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

/**
 * Everything is read for the brand of the link the token opens: the design through the token, the
 * brand's charts and only the pictures the shared version uses. The server's key reaches the
 * database here only through the share functions and the file reader, never a visitor.
 */
const shareDeps = () => ({
  open: (token: string) => openShare(adminClient(), token),
  charts: (brandId: string, at?: string) => brandChartSet(adminClient(), brandId, at),
  reader: (brandId: string) => createFileReader(adminClient(), brandId),
  shrink: shrinkForDrawing,
});

export default async function SharePage({ params }: PageProps<"/s/[token]">) {
  // Settings are read when the page is asked for, never when the app is built.
  await connection();
  const address = await productionDeps.getClientAddress();
  const allowed = await productionDeps.hitRateLimit(`${LIMITS.shareView.name}:address:${address}`, LIMITS.shareView);
  const { token } = await params;
  const loaded = allowed ? await loadSharePage(shareDeps(), token) : null;
  if (allowed && !loaded) notFound();

  return (
    <>
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center px-5">
          <Logo />
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-5 py-10">
        {loaded ? (
          <>
            <SharedDesign page={loaded.page} picturesNote={loaded.picturesNote} />
            <section aria-labelledby="share-answer" className="flex max-w-xl flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 id="share-answer" className="text-lg font-semibold text-ink">
                  What do you think?
                </h2>
                <p className="text-sm text-muted">
                  Your name, vote and comment are seen by {loaded.page.brandName}. We do not ask for your email
                  and we will not contact you. See the{" "}
                  <Link href="/legal/privacy" className="text-cobalt underline-offset-4 hover:underline">
                    privacy notice
                  </Link>
                  .
                </p>
              </div>
              <ResponseForm token={token} siteKey={getEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
            </section>
          </>
        ) : (
          <p role="alert" className="text-[15px] text-ink-2">
            Too many requests from your network. Wait a minute, then reload the page.
          </p>
        )}
      </main>
    </>
  );
}
