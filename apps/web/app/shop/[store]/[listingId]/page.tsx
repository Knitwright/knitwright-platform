import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuyForm } from "@/components/storefront/shop/BuyForm";
import { ShopFrame } from "@/components/storefront/shop/ShopFrame";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { formatMoney } from "@/lib/factory/pricing";
import { sizeGuide } from "@/lib/products/size-guide";
import { nextCutoff } from "@/lib/storefront/batching";
import { currentDrop, dropState, windowLine } from "@/lib/storefront/drops";
import { fromPrice } from "@/lib/storefront/listing";
import { paragraphsOf } from "@/lib/storefront/policy";
import { loadShopProduct } from "@/lib/storefront/server";

export const metadata: Metadata = { title: "Product" };

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * A PRODUCT PAGE of a brand's storefront (spec F-L5: "media, a garment-measurement size chart, a fit note, the
 * delivery date and personalisation where allowed"). The delivery date is not promised until the factory confirms
 * it (10 §10), so the page says when the order goes to the factory instead.
 */
export default async function ShopProductPage({ params }: PageProps<"/shop/[store]/[listingId]">) {
  const { store, listingId } = await params;
  const product = await loadShopProduct(store, listingId);
  if (product === null) notFound();
  const { storefront, listing, images, sizes, chart } = product;
  const now = new Date();
  const drop = currentDrop(product.drops, now);
  const open = listing.mode === "made_to_order" || (drop !== null && dropState(drop, now) === "open");
  const from = fromPrice(listing.prices);
  const guide = chart && chart.rows.length > 0 ? sizeGuide(chart, "cm") : null;
  const when =
    listing.mode === "made_to_order"
      ? `Made to order: it goes to the factory ${DAY.format(nextCutoff(now))}.`
      : drop
        ? `Pre-order ${windowLine(drop)}. Everything ordered in the drop is made together after it closes.`
        : "This drop is not open.";

  return (
    <ShopFrame name={storefront.name} slug={storefront.slug} accent={product.accent}>
      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="Pictures" className="grid grid-cols-2 gap-3">
          {images.length === 0 ? <div className="col-span-2 grid aspect-square place-items-center rounded-xl bg-soft text-muted">No picture</div> : null}
          {images.map((image, index) => (
            <figure key={image.id} className={index === 0 ? "col-span-2 flex flex-col gap-1" : "flex flex-col gap-1"}>
              <span className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element -- A render made on the server or a short-lived storage link. */}
                <img src={image.src} alt={image.label} className="max-h-full max-w-full object-contain" />
              </span>
              {image.aiLabel ? <figcaption className="text-caption text-muted">{image.aiLabel}: a picture made with AI. The true colours are in the product render.</figcaption> : null}
            </figure>
          ))}
        </section>
        <section className="flex flex-col gap-5" aria-labelledby="product-title">
          <h1 id="product-title" className="text-h1 text-text">{listing.title || "Untitled"}</h1>
          <p className="text-h3 text-text">{from === null ? "" : formatMoney(from, listing.currency)}</p>
          <p className="text-body text-text-2">{when} No delivery date is promised until the factory confirms it.</p>
          <BuyForm
            slug={storefront.slug}
            listingId={listing.id}
            currency={listing.currency}
            prices={listing.prices}
            sizes={sizes}
            personalisation={listing.personalisation}
            onSale={open && sizes.length > 0}
            closedReason={drop ? `This drop opens ${windowLine(drop)}.` : "This product is not on sale right now."}
          />
          <div className="flex flex-col gap-3 text-body text-text-2">
            {paragraphsOf(listing.description).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </section>
      </div>
      {guide ? (
        <section aria-labelledby="size-chart" className="flex flex-col gap-3">
          <h2 id="size-chart" className="text-h3 text-text">Size chart (garment measurements, cm)</h2>
          <p className="text-small text-muted">Measured flat on the garment, not on the body. Compare with a shirt you own that fits you well.</p>
          <Table caption="Size chart">
            <thead><tr><Th>Measurement</Th>{guide.sizes.map((size) => <Th key={size} numeric>{size}</Th>)}</tr></thead>
            <tbody>
              {guide.rows.map((row) => (
                <Tr key={row.label}>
                  <Td>{row.label}</Td>
                  {row.cells.map((cell, index) => <Td key={guide.sizes[index]} numeric>{cell ?? "—"}</Td>)}
                </Tr>
              ))}
            </tbody>
          </Table>
        </section>
      ) : null}
      <section aria-labelledby="returns" className="flex flex-col gap-2">
        <h2 id="returns" className="text-h3 text-text">Returns</h2>
        {paragraphsOf(storefront.returnsPolicy).map((paragraph) => <p key={paragraph} className="text-body text-text-2">{paragraph}</p>)}
      </section>
    </ShopFrame>
  );
}
