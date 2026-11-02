import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CommitteeView } from "@/components/committee/CommitteeView";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { PAGE_WIDTH, pageFrame } from "@/components/shell/page-width";
import { ResponseForm } from "@/components/share/ResponseForm";
import { SharedDesign } from "@/components/share/SharedDesign";
import { brandChartSet } from "@/lib/charts/service";
import { getEnv } from "@/lib/config/env";
import { adminClient, productionDeps } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { loadCommitteePage } from "@/lib/share/committee/public-load";
import { openCommittee } from "@/lib/share/committee/service";
import { loadSharePage } from "@/lib/share/public-load";
import { openShare } from "@/lib/share/service";
import { createFileReader } from "@/lib/storage/read";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";

/**
 * A design shared with people who have no account (decision 0026), and a committee asked to
 * comment, vote and approve (spec F-T3, plan v5 Z7, decision 0086). Both kinds of link live at this
 * one address because both are the same thing to a visitor: a token, and nothing else, deciding
 * what they may see. The page is never indexed, never stored by a cache and never sends its address
 * on (next.config.ts sets the headers). An unknown, expired or revoked link is the page that does
 * not exist, with nothing to tell the three apart; `not-found.tsx` beside this file says in plain
 * words what probably happened and who to ask.
 *
 * There is deliberately no `loading.tsx` in this folder: a loading file flushes the shell before
 * the page runs, and `notFound()` could then no longer set a 404, so a withdrawn link would answer
 * 200 (plan v5 Lessons).
 */
export const metadata: Metadata = {
  title: "Shared design",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

/**
 * Everything is read for the brand of the link the token opens: the design through the token, the
 * brand's charts and only the pictures the shared version uses. The server's key reaches the
 * database here only through the share and committee functions and the file reader, never a visitor.
 */
const readDeps = () => ({
  charts: (brandId: string, at?: string) => brandChartSet(adminClient(), brandId, at),
  reader: (brandId: string) => createFileReader(adminClient(), brandId),
  shrink: shrinkForDrawing,
});

const committeeDeps = () => ({ ...readDeps(), open: (token: string) => openCommittee(adminClient(), token) });
const shareDeps = () => ({ ...readDeps(), open: (token: string) => openShare(adminClient(), token) });

const TOO_MANY = "Too many requests from your network. Wait a minute, then reload the page.";

export default async function SharePage({ params }: PageProps<"/s/[token]">) {
  // Settings are read when the page is asked for, never when the app is built.
  await connection();
  const address = await productionDeps.getClientAddress();
  const allowed = await productionDeps.hitRateLimit(`${LIMITS.shareView.name}:address:${address}`, LIMITS.shareView);
  const { token } = await params;
  if (!allowed) {
    return (
      <>
        <PublicHeader linkHome={false} />
        <main id="main" className={`rise ${pageFrame("content")} flex flex-col gap-10 py-10`}>
          <p role="alert" className="text-[15px] text-ink-2">
            {TOO_MANY}
          </p>
        </main>
      </>
    );
  }

  // A committee link first, then an ordinary share link. A token opens one or the other, never both.
  const committee = await loadCommitteePage(committeeDeps(), token);
  const loaded = committee ? null : await loadSharePage(shareDeps(), token);
  if (!committee && !loaded) notFound();

  return (
    <>
      <PublicHeader linkHome={false} />
      <main id="main" className={`rise ${pageFrame("content")} flex flex-col gap-10 py-10`}>
        {committee ? (
          <CommitteeView page={committee.page} token={token} siteKey={getEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
        ) : loaded ? (
          <>
            <SharedDesign page={loaded.page} picturesNote={loaded.picturesNote} />
            {loaded.inviteNote ? (
              <p className={`flex ${PAGE_WIDTH.form} text-sm text-muted`} data-testid="share-invite-note">
                {loaded.inviteNote}
              </p>
            ) : null}
            {/* An invite is one person's own and is not answered through (plan v5 Y8, decision 0081). */}
            {loaded.canAnswer ? (
              <section aria-labelledby="share-answer" className={`flex ${PAGE_WIDTH.form} flex-col gap-4`}>
                <div className="flex flex-col gap-1">
                  <h2 id="share-answer" className="text-lg font-semibold text-ink">
                    What do you think?
                  </h2>
                  <p className="text-sm text-muted">
                    Your name, vote and comment are seen by {loaded.page.brandName}. We do not ask for your email
                    and we will not contact you. See the{" "}
                    <Link href="/legal/privacy" className="soft-link text-ink underline underline-offset-4">
                      privacy notice
                    </Link>
                    .
                  </p>
                </div>
                <ResponseForm token={token} siteKey={getEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
              </section>
            ) : null}
          </>
        ) : null}
      </main>
    </>
  );
}
