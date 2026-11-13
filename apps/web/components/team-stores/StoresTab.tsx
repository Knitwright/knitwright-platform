import type { Route } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/PageStates";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { can } from "@/lib/clubs/roles";
import { getEnv } from "@/lib/config/env";
import { sessionClient } from "@/lib/server/deps";
import { clubPageAddress, suggestSlug } from "@/lib/team-stores/host";
import { listPurchases, listStores, readClubPage } from "@/lib/team-stores/reads";
import { namesList, storeCard } from "@/lib/team-stores/view";
import { ClubPageForm } from "./ClubPageForm";
import { StoreCardView } from "./StoreCardView";

type Brand = Readonly<{ id: string; name: string; role: Parameters<typeof can>[0] }>;

/**
 * TEAM › STORES (plan v6 C2, decision 0153; P6's Team page, decision 0144): every store window of the club with
 * its link, QR code and state, the names and numbers each has collected, and the club page's settings. Stores are
 * opened from a design's Order drawer, where the design and its prices are.
 */
export async function StoresTab({ brand }: Readonly<{ brand: Brand }>) {
  const client = await sessionClient();
  const env = getEnv();
  const [stores, page] = await Promise.all([listStores(client, brand.id), readClubPage(client, brand.id)]);
  const purchases = await listPurchases(client, stores.map((store) => store.id));
  const now = new Date();
  const canEdit = can(brand.role, "manageKit");

  return (
    <div className="flex flex-col gap-8" data-testid="team-stores">
      <section className="flex flex-col gap-3" aria-labelledby="team-stores-heading">
        <h2 id="team-stores-heading" className="text-h3 text-text">
          Team stores
        </h2>
        {stores.length === 0 ? (
          <EmptyState icon={<Icon icon={Store} size={24} />} title="No team store yet">
            Open one from a design: open the design, choose Order, then the Team store tab.{" "}
            <Link href={"/projects" as Route} className="font-semibold text-link live:hover:underline">
              Your designs
            </Link>
          </EmptyState>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {stores.map((store) => {
              const bought = purchases.get(store.id) ?? [];
              const names = namesList(bought);
              return (
                <div key={store.id} className="flex flex-col gap-2">
                  <StoreCardView card={storeCard(store, bought, now, env.NEXT_PUBLIC_SITE_URL)} canEdit={canEdit} />
                  {names.length > 0 ? (
                    <details className="rounded-lg border border-border">
                      <summary className="flex min-h-10 cursor-pointer items-center px-3 text-small font-semibold text-text">Names and numbers ({names.length})</summary>
                      <Table caption={`Names and numbers bought from ${store.title}`}>
                        <thead>
                          <Tr>
                            <Th>Size</Th>
                            <Th>Name</Th>
                            <Th numeric>Number</Th>
                            <Th>Bought by</Th>
                          </Tr>
                        </thead>
                        <tbody>
                          {names.map((row) => (
                            <Tr key={row.key}>
                              <Td>{row.size}</Td>
                              <Td>{row.name || "—"}</Td>
                              <Td numeric>{row.number || "—"}</Td>
                              <Td>{row.buyer || "Erased"}</Td>
                            </Tr>
                          ))}
                        </tbody>
                      </Table>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="club-page-heading">
        <h2 id="club-page-heading" className="text-h3 text-text">
          Club page
        </h2>
        <p className="text-body text-muted">Your crest, kit colours, open stores, size guide and contact, at your club&apos;s own address.</p>
        {page?.published ? (
          <a href={clubPageAddress(page.slug, env.CLUB_PAGES_DOMAIN, env.NEXT_PUBLIC_SITE_URL)} className="text-small font-semibold text-link live:hover:underline" data-testid="club-page-link">
            {clubPageAddress(page.slug, env.CLUB_PAGES_DOMAIN, env.NEXT_PUBLIC_SITE_URL)}
          </a>
        ) : null}
        {canEdit ? (
          <ClubPageForm page={page === null ? null : { ...page, address: clubPageAddress(page.slug, env.CLUB_PAGES_DOMAIN, env.NEXT_PUBLIC_SITE_URL) }} suggested={suggestSlug(brand.name)} rootDomain={env.CLUB_PAGES_DOMAIN ?? null} />
        ) : (
          <p className="text-small text-muted">Your role in this club can look at the page but not change it.</p>
        )}
      </section>
    </div>
  );
}
