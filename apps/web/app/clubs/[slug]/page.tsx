import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { pageFrame } from "@/components/shell/page-width";
import { SizeGuides } from "@/components/team-stores/SizeGuides";
import { formatMoney } from "@/lib/factory/pricing";
import { adminClient, productionDeps } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { createDownloadLink } from "@/lib/storage/links";
import { isClubSlug } from "@/lib/team-stores/host";
import { readPublicClubPage } from "@/lib/team-stores/reads";
import { piecePriceMinor, whenText } from "@/lib/team-stores/rules";

/**
 * A CLUB'S PAGE (spec F-T6 "Club page: `<club>.knitwright.com` shows the crest, colours, current kit, open stores,
 * size guide and contact"; plan v6 C2, decision 0153). `proxy.ts` shows it at the root of the club's subdomain; it
 * is also at /clubs/<slug>, which is how it is reached locally and before the wildcard domain is set up. Only a
 * page its club has published exists. It names no person except through the contact line the club chose.
 */
export const metadata: Metadata = { title: "Club" };

const TOO_MANY = "Too many requests from your network. Wait a minute, then reload the page.";

/** A minute-long link to the crest, or null when there is none or it cannot be read. */
async function crestUrl(brandId: string, fileId: string | null): Promise<string | null> {
  if (fileId === null) return null;
  return createDownloadLink(adminClient(), brandId, fileId).then((link) => link.url, () => null);
}

export default async function ClubPage({ params }: PageProps<"/clubs/[slug]">) {
  await connection();
  const address = await productionDeps.getClientAddress();
  const allowed = await productionDeps.hitRateLimit(`${LIMITS.teamStoreView.name}:address:${address}`, LIMITS.teamStoreView);
  const { slug } = await params;
  const now = new Date();
  const loaded = allowed && isClubSlug(slug) ? await readPublicClubPage(adminClient(), slug, now) : null;
  if (allowed && !loaded) notFound();
  const crest = loaded ? await crestUrl(loaded.club.brandId, loaded.club.kit.crestFileId) : null;
  const colours = loaded ? [loaded.club.kit.primaryColour, loaded.club.kit.secondaryColour, loaded.club.kit.accentColour].filter((colour): colour is string => colour !== null) : [];

  return (
    <>
      <PublicHeader linkHome={false} />
      <main id="main" className={`rise ${pageFrame("content")} flex flex-col gap-10 py-10`}>
        {loaded ? (
          <>
            <header className="flex flex-wrap items-center gap-5">
              {crest ? (
                // A signed storage link that lasts a minute: the image optimiser would fetch it after it expired.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={crest} alt={`${loaded.club.name} crest`} className="size-20 rounded-lg object-contain" />
              ) : null}
              <div className="flex flex-col gap-2">
                <h1 className="text-h1 text-text" data-testid="club-name">
                  {loaded.club.name}
                </h1>
                {colours.length > 0 ? (
                  <ul className="flex gap-2" aria-label="Club colours">
                    {colours.map((colour) => (
                      <li key={colour} className="size-6 rounded-full border border-border" style={{ backgroundColor: colour }} title={colour}>
                        <span className="sr-only">{colour}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </header>
            <section className="flex flex-col gap-3" aria-labelledby="club-stores">
              <h2 id="club-stores" className="text-h3 text-text">
                Kit on sale
              </h2>
              {loaded.stores.length === 0 ? (
                <p className="text-body text-muted">No store is open right now. The club will share the link when the next one opens.</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {loaded.stores.map((store) => (
                    <li key={store.id} className="flex flex-col gap-1 rounded-lg border border-border p-4">
                      <Link href={`/t/${store.code}` as `/t/${string}`} className="text-title text-link live:hover:underline">
                        {store.title}
                      </Link>
                      <p className="text-small text-text-2">
                        {formatMoney(piecePriceMinor(store), store.currency)} a piece · {whenText(store, now)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="flex flex-col gap-3" aria-labelledby="club-sizes">
              <h2 id="club-sizes" className="text-h3 text-text">
                Sizes
              </h2>
              <SizeGuides brandId={loaded.club.brandId} />
            </section>
            {loaded.club.page?.contact ? (
              <section className="flex flex-col gap-1" aria-labelledby="club-contact">
                <h2 id="club-contact" className="text-h3 text-text">
                  Contact
                </h2>
                <p className="text-body text-text-2">{loaded.club.page.contact}</p>
              </section>
            ) : null}
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
