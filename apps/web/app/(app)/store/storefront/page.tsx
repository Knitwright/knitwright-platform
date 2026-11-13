import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DropList, NewDropForm, SendBatchesButton } from "@/components/storefront/DropsPanel";
import { StorefrontSettingsForm } from "@/components/storefront/StorefrontSettingsForm";
import { Icon } from "@/components/ui/Icon";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { can } from "@/lib/clubs/roles";
import { loadCollections } from "@/lib/collections/server";
import { getEnv } from "@/lib/config/env";
import { formatMoney } from "@/lib/factory/pricing";
import { BATCH_STATUS_LABELS, nextCutoff } from "@/lib/storefront/batching";
import { batchesOfBrand, readDrops, readListings, shopOrdersOfBrand, soldInDrops } from "@/lib/storefront/db";
import { dropCards } from "@/lib/storefront/drops";
import { domainSuffix, slugFrom, storefrontUrl } from "@/lib/storefront/host";
import { CHANNEL_LABELS, STATUS_LABELS } from "@/lib/storefront/listing";
import { listingEditorPath } from "@/lib/storefront/routes";
import { loadStorefront } from "@/lib/storefront/server";
import { storefrontDefaults } from "@/lib/storefront/settings";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Storefront" };

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/**
 * THE BRAND'S STOREFRONT (plan v6 C3, decision 0154; spec F-L5): its settings and returns policy, its listings, its
 * drops (made from collection plans) and the batches its sales go to production in. C5's Store pages link here.
 */
export default async function StorefrontPage() {
  const { brand } = await requireMember();
  const client = await sessionClient();
  const now = new Date();
  const [storefront, listings, drops, batches, orders, plans] = await Promise.all([
    loadStorefront(client, brand.id),
    readListings(client, brand.id),
    readDrops(client, brand.id),
    batchesOfBrand(client, brand.id),
    shopOrdersOfBrand(client, brand.id, 20),
    loadCollections(client, brand.id),
  ]);
  const sold = await soldInDrops(client, drops.map((drop) => drop.id));
  const canEdit = can(brand.role, "manageKit");
  const titleOf = new Map(listings.map((listing) => [listing.id, listing.title || "Untitled listing"]));
  const live = storefront?.status === "live" ? storefrontUrl(storefront.slug, getEnv().NEXT_PUBLIC_SITE_URL, getEnv().CLUB_PAGES_DOMAIN) : null;

  return (
    <div className="flex flex-col gap-6 pt-6 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 text-text">Storefront</h1>
          <p className="text-body text-muted">Your own shop, its drops and the weekly batches its sales are made in.</p>
        </div>
        {live ? (
          <a href={live} className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-body font-semibold text-text no-underline live:hover:bg-soft" data-testid="open-storefront">
            Open storefront
            <Icon icon={ExternalLink} size={16} />
          </a>
        ) : null}
      </header>

      <StorefrontSettingsForm initial={storefrontDefaults(storefront, brand.name, slugFrom(brand.name))} canEdit={canEdit} suffix={domainSuffix(getEnv().CLUB_PAGES_DOMAIN)} />

      <section aria-labelledby="listings-heading" className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-5">
        <h2 id="listings-heading" className="text-h3 text-text">Listings</h2>
        {listings.length === 0 ? (
          <p className="text-body text-muted">
            No listings yet. Open a product from{" "}
            <Link href="/products/mine" className="text-link underline underline-offset-4">My products</Link> and choose its listing.
          </p>
        ) : (
          <Table caption="Listings">
            <thead><tr><Th>Listing</Th><Th>Status</Th><Th>Sold on</Th><Th>How it sells</Th></tr></thead>
            <tbody>
              {listings.map((listing) => (
                <Tr key={listing.id}>
                  <Td><Link href={listingEditorPath(listing.productId)} className="font-semibold text-text">{titleOf.get(listing.id)}</Link></Td>
                  <Td>{STATUS_LABELS[listing.status]}</Td>
                  <Td>{CHANNEL_LABELS[listing.channel]}</Td>
                  <Td>{listing.mode === "drop" ? "In a drop" : "Made to order"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section aria-labelledby="drops-heading" className="flex flex-col gap-4 rounded-xl border border-border bg-bg p-5">
        <h2 id="drops-heading" className="text-h3 text-text">Drops</h2>
        <NewDropForm plans={plans.map((plan) => ({ id: plan.id, name: plan.name }))} canEdit={canEdit} />
        <DropList drops={dropCards(drops, sold, now)} canEdit={canEdit} />
      </section>

      <section aria-labelledby="batches-heading" className="flex flex-col gap-4 rounded-xl border border-border bg-bg p-5">
        <h2 id="batches-heading" className="text-h3 text-text">Batches</h2>
        <SendBatchesButton canEdit={canEdit} next={`Monday at 12:00 Pakistan time (next: ${DAY.format(nextCutoff(now))} UTC)`} />
        {batches.length === 0 ? (
          <p className="text-body text-muted">No batches yet. Paid sales wait here until the cut-off.</p>
        ) : (
          <Table caption="Batches">
            <thead><tr><Th>Listing</Th><Th>Kind</Th><Th>Pieces</Th><Th>Status</Th></tr></thead>
            <tbody>
              {batches.map((batch) => (
                <Tr key={batch.id}>
                  <Td>{batch.listingId ? (titleOf.get(batch.listingId) ?? "A listing") : "A listing no longer here"}</Td>
                  <Td>{batch.kind === "drop" ? "Drop close" : "Weekly"}</Td>
                  <Td>{batch.pieces}</Td>
                  <Td>
                    {BATCH_STATUS_LABELS[batch.status]}
                    {batch.message ? <span className="block text-caption text-muted">{batch.message}</span> : null}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section aria-labelledby="orders-heading" className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-5">
        <h2 id="orders-heading" className="text-h3 text-text">Recent storefront orders</h2>
        {orders.length === 0 ? (
          <p className="text-body text-muted">No orders yet.</p>
        ) : (
          <Table caption="Recent storefront orders">
            <thead><tr><Th>Listing</Th><Th>Size</Th><Th>Qty</Th><Th>Amount</Th><Th>Batch</Th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <Tr key={order.id}>
                  <Td>{order.listingId ? (titleOf.get(order.listingId) ?? "A listing") : "—"}</Td>
                  <Td>{order.size}{order.personalName || order.personalNumber !== null ? ` · ${order.personalName ?? ""} ${order.personalNumber ?? ""}`.trimEnd() : ""}</Td>
                  <Td>{order.qty}</Td>
                  <Td>{formatMoney(order.amountMinor, order.currency)}</Td>
                  <Td>{order.batchId ? "In a batch" : "Waiting"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
