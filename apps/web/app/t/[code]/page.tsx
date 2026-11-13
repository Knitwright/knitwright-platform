import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { pageFrame } from "@/components/shell/page-width";
import { BuyForm } from "@/components/team-stores/BuyForm";
import { SizeGuides } from "@/components/team-stores/SizeGuides";
import { Notice } from "@/components/ui/Notice";
import { getEnv } from "@/lib/config/env";
import { formatMoney } from "@/lib/factory/pricing";
import { adminClient, productionDeps } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { clubPagePath } from "@/lib/team-stores/host";
import { readPublicStore } from "@/lib/team-stores/reads";
import { isStoreCode, piecePriceMinor, whenText, windowState } from "@/lib/team-stores/rules";

/**
 * A TEAM STORE (spec F-T6 step 2; plan v6 C2, decision 0153): the page a player or parent opens from the club's
 * link or QR code, on a phone, with no account. It shows the club's name, the store's name, the price a piece and
 * when it closes, the size guide, and the order form; nothing about any other buyer. The page is never indexed and
 * never cached (next.config.ts), and there is no loading.tsx, so a code that opens nothing answers 404.
 */
export const metadata: Metadata = {
  title: "Team store",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

const TOO_MANY = "Too many requests from your network. Wait a minute, then reload the page.";

const CLOSED: Readonly<Record<string, string>> = {
  scheduled: "This store has not opened yet.",
  due: "This store has closed. The club's order is being put together.",
  closing: "This store has closed. The club's order is being put together.",
  closed: "This store has closed, and the club's order has gone to production.",
  refunding: "This store closed without enough orders, so everyone who paid is being refunded.",
  refunded: "This store closed without enough orders, and everyone who paid was refunded.",
};

export default async function TeamStorePage({ params }: PageProps<"/t/[code]">) {
  await connection();
  const address = await productionDeps.getClientAddress();
  const allowed = await productionDeps.hitRateLimit(`${LIMITS.teamStoreView.name}:address:${address}`, LIMITS.teamStoreView);
  const { code } = await params;
  const loaded = allowed && isStoreCode(code) ? await readPublicStore(adminClient(), code) : null;
  if (allowed && !loaded) notFound();
  const now = new Date();
  const state = loaded ? windowState(loaded.store, now) : null;

  return (
    <>
      <PublicHeader linkHome={false} width="form" />
      <main id="main" className={`rise ${pageFrame("form")} flex flex-col gap-8 py-10`}>
        {loaded && state ? (
          <>
            <header className="flex flex-col gap-2">
              <p className="text-small text-muted">
                {loaded.club.page?.published ? (
                  <Link href={clubPagePath(loaded.club.page.slug) as `/clubs/${string}`} className="text-link live:hover:underline">
                    {loaded.club.name}
                  </Link>
                ) : (
                  loaded.club.name
                )}{" "}
                · Team store
              </p>
              <h1 className="text-h1 text-text" data-testid="team-store-title">
                {loaded.store.title}
              </h1>
              <p className="text-body-lg text-text-2">
                {formatMoney(piecePriceMinor(loaded.store), loaded.store.currency)} a piece · {whenText(loaded.store, now)}
              </p>
              <p className="text-small text-muted">
                Pay for your own kit here. When the store closes, the club&apos;s pieces are made together and sent to the club in one delivery. If fewer than {loaded.store.minPieces} pieces are ordered,
                everyone is refunded in full.
              </p>
            </header>
            {state === "open" ? (
              <BuyForm
                store={{
                  code: loaded.store.code,
                  currency: loaded.store.currency,
                  pieceMinor: piecePriceMinor(loaded.store),
                  sizes: loaded.store.sizes,
                  namesNumbers: loaded.store.namesNumbers,
                  nameMax: loaded.store.nameMax,
                  numberMin: loaded.store.numberMin,
                  numberMax: loaded.store.numberMax,
                }}
                siteKey={getEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              />
            ) : (
              <Notice tone="info">{CLOSED[state] ?? CLOSED.closed}</Notice>
            )}
            <SizeGuides brandId={loaded.store.brandId} />
            <p className="text-small text-muted">
              We keep your name and email for the receipt and any refund, and the shirt names for printing, then erase them 180 days after the store closes.{" "}
              <Link href="/legal/privacy" className="text-link live:hover:underline">
                Privacy notice
              </Link>
              .
            </p>
          </>
        ) : (
          <p role="alert" className="text-body text-text-2">
            {TOO_MANY}
          </p>
        )}
      </main>
    </>
  );
}
