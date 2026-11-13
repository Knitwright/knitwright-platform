import { AppError } from "@/lib/server/core/errors";
import type { ShopifyAdmin } from "./shopify/admin";
import { ensureRegistered, shopOf, type InstallDeps } from "./shopify/install";
import type { ChannelsStore, ConnectionSecret, ListingRow } from "./store";

/**
 * PUSHING A PRODUCT (plan v6 C4, decision 0155; spec F-L6 "push products with media and variants", wizard steps 3–5).
 *
 * The caller has already run the order gates with the person present (the D1 validation gate, the content screen and
 * the F-G2 checklist, exactly as an order does) and fixed the terms every order of this listing is made on: the
 * newest release, the fabric and the factory profile. Here the product goes to Shopify with one variant per size,
 * each with a SKU that names the product and size, stocked at Knitwright's fulfilment location, and each variant is
 * recorded so an incoming order line can be matched back to it.
 *
 * Pictures: C3's listing editor owns a listing's mockups; until it does, the product goes without media and the
 * brand adds pictures in Shopify (labelled on the screen).
 */

export type OrderTerms = Readonly<{
  releaseId: string;
  factoryProfileId: string;
  fabricKey: string;
  flags: readonly Readonly<{ code: string; text: string }>[];
}>;

export type ProductForChannel = Readonly<{
  productId: string;
  name: string;
  sizes: readonly string[];
  terms: OrderTerms;
}>;

export type PushDeps = InstallDeps & Readonly<{ admin: ShopifyAdmin; store: ChannelsStore }>;

export const NOT_OPEN = "The connection to this shop can no longer be read. Disconnect it and connect again.";
export const NO_SIZES = "This product has no sizes to sell yet.";

/** A size as it may appear in a SKU: letters, digits, `_` and `-`. */
const skuSize = (size: string): string => size.trim().replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 20);

/** `KW-<product id without dashes>-<size>`: unique per product and size, and read back from an order or a CSV. */
export const skuOf = (productId: string, size: string): string => `KW-${productId.replaceAll("-", "").toLowerCase()}-${skuSize(size)}`;

/** The product id and size a SKU names, or null when it is not one of ours. */
export function readSku(sku: string): Readonly<{ productId: string; size: string }> | null {
  const match = /^KW-([0-9a-f]{32})-([A-Za-z0-9_-]{1,20})$/.exec(sku.trim());
  if (!match) return null;
  const hex = match[1]!;
  return { productId: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`, size: match[2]! };
}

export async function pushProduct(
  deps: PushDeps,
  who: Readonly<{ brandId: string; userId: string }>,
  connection: ConnectionSecret,
  product: ProductForChannel,
  price: Readonly<{ priceMinor: number; currency: "GBP" | "AUD" }>,
  existing: readonly ListingRow[],
): Promise<number> {
  if (product.sizes.length === 0) throw new AppError("conflict", NO_SIZES);
  const shop = shopOf(deps.key, connection);
  if (shop === null) throw new AppError("conflict", NOT_OPEN);
  await ensureRegistered(deps, connection);
  const located = (await deps.store.secretById(connection.id)) ?? connection;
  const before = existing.find((row) => row.productId === product.productId && row.connectionId === connection.id);

  const pushed = await deps.admin.pushProduct(shop, {
    existingProductId: before?.externalProductId ?? null,
    title: product.name,
    description: `${product.name}. Made to order by Knitwright in Sialkot.`,
    variants: product.sizes.map((size) => ({ size, sku: skuOf(product.productId, size), priceMinor: price.priceMinor })),
    currency: price.currency,
    locationId: located.locationId,
  });

  let recorded = 0;
  for (const size of product.sizes) {
    const variant = pushed.variants.find((one) => one.size === size);
    if (!variant) continue;
    await deps.store.recordListing(who.brandId, who.userId, {
      connectionId: connection.id,
      productId: product.productId,
      sizeLabel: size,
      externalProductId: pushed.productId,
      externalVariantId: variant.variantId,
      sku: skuOf(product.productId, size),
      priceMinor: price.priceMinor,
      currency: price.currency,
      releaseId: product.terms.releaseId,
      factoryProfileId: product.terms.factoryProfileId,
      fabricKey: product.terms.fabricKey,
      flags: product.terms.flags,
    });
    recorded += 1;
  }
  return recorded;
}
