import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShopFrame } from "@/components/storefront/shop/ShopFrame";
import { formatMoney } from "@/lib/factory/pricing";
import { shopPath } from "@/lib/storefront/host";
import { fromPrice } from "@/lib/storefront/listing";
import { loadShop } from "@/lib/storefront/server";

export const metadata: Metadata = { title: "Shop" };

/**
 * A BRAND'S STOREFRONT (plan v6 C3, decision 0154; spec F-L5 "`<brand>.knitwright.com`"). Public: a shopper has no
 * account. The proxy sends `<slug>.knitwright.com` here; locally the address is `/shop/<slug>`. Only a live storefront
 * answers, and it shows only its published listings; anything else is not found.
 */
export default async function ShopPage({ params }: PageProps<"/shop/[store]">) {
  const { store } = await params;
  const shop = await loadShop(store);
  if (shop === null) notFound();
  const { storefront, cards } = shop;
  return (
    <ShopFrame name={storefront.name} slug={storefront.slug} accent={shop.accent}>
      <h1 className="text-h1 text-text">{storefront.name}</h1>
      {cards.length === 0 ? (
        <p className="text-body-lg text-muted">Nothing is on sale right now. Come back soon.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" aria-label="Products">
          {cards.map(({ listing, image, note }) => {
            const from = fromPrice(listing.prices);
            return (
              <li key={listing.id}>
                <Link href={shopPath(storefront.slug, `/${listing.id}`) as Route} className="group flex flex-col gap-2 text-text no-underline">
                  <span className="relative grid aspect-square place-items-center overflow-hidden rounded-xl bg-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element -- A render made on the server or a short-lived storage link. */}
                    {image ? <img src={image.src} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-small text-muted">No picture</span>}
                    {image?.aiLabel ? <span className="absolute right-2 bottom-2 rounded-xs bg-navy px-1.5 py-0.5 text-micro text-on-dark">{image.aiLabel}</span> : null}
                  </span>
                  <span className="text-body-lg font-semibold group-hover:underline">{listing.title || "Untitled"}</span>
                  <span className="text-body text-text-2">{from === null ? "" : `From ${formatMoney(from, listing.currency)}`}</span>
                  <span className="text-small text-muted">{note}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ShopFrame>
  );
}
