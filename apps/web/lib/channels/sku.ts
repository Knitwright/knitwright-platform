/** SKUs and the words shared by the server and the Channels screen (decision 0155). Pure: safe in a browser. */

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
