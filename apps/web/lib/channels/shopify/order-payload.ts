import { z } from "zod";
import type { ShipTo, ShopifyOrder } from "./admin";

/**
 * Shopify's order as the `orders/paid` webhook sends it (REST shape, snake case), and as the Admin GraphQL API
 * answers it, both reduced to `ShopifyOrder`. Anything not needed to make and ship the order is dropped here: no
 * buyer email, no prices, no notes.
 */

const id = z.union([z.number().int().nonnegative(), z.string().regex(/^\d{1,30}$/)]).transform(String);
const text = (max: number) => z.string().nullish().transform((value) => (value ?? "").trim().slice(0, max));

const address = z
  .object({
    name: text(120),
    first_name: text(60),
    last_name: text(60),
    address1: text(200),
    address2: text(200),
    city: text(100),
    province: text(100),
    zip: text(20),
    country_code: text(2),
    phone: text(40),
  })
  .partial();

const restOrder = z.object({
  id,
  name: z.string().min(1).max(80),
  currency: z.string().regex(/^[A-Z]{3}$/),
  line_items: z
    .array(
      z.object({
        id,
        variant_id: id.nullish(),
        sku: text(64),
        quantity: z.number().int().min(1).max(99999),
      }),
    )
    .max(250),
  shipping_address: address.nullish(),
});

export function shipToOf(raw: z.infer<typeof address> | null | undefined): ShipTo | null {
  if (!raw) return null;
  const name = raw.name || `${raw.first_name ?? ""} ${raw.last_name ?? ""}`.trim();
  return {
    name: name ?? "",
    address1: raw.address1 ?? "",
    address2: raw.address2 ?? "",
    city: raw.city ?? "",
    region: raw.province ?? "",
    postcode: raw.zip ?? "",
    country: raw.country_code ?? "",
    phone: raw.phone ?? "",
  };
}

/** The webhook body as an order, or null when it is not one. */
export function orderFromWebhook(body: unknown): ShopifyOrder | null {
  const parsed = restOrder.safeParse(body);
  if (!parsed.success) return null;
  const order = parsed.data;
  return {
    id: order.id,
    name: order.name,
    currency: order.currency,
    lines: order.line_items.map((line) => ({ id: line.id, variantId: line.variant_id ?? null, sku: line.sku, quantity: line.quantity })),
    shipTo: shipToOf(order.shipping_address),
  };
}

/** The numeric id at the end of a Shopify global id, `gid://shopify/Order/123` → `123`. */
export const numericId = (gid: string): string => gid.slice(gid.lastIndexOf("/") + 1);

const gqlOrder = z.object({
  id: z.string(),
  name: z.string(),
  currencyCode: z.string(),
  lineItems: z.object({ nodes: z.array(z.object({ id: z.string(), quantity: z.number().int(), sku: z.string().nullish(), variant: z.object({ id: z.string() }).nullish() })) }),
  shippingAddress: z
    .object({ name: z.string().nullish(), address1: z.string().nullish(), address2: z.string().nullish(), city: z.string().nullish(), province: z.string().nullish(), zip: z.string().nullish(), countryCodeV2: z.string().nullish(), phone: z.string().nullish() })
    .nullish(),
});

/** One node of the Admin API's `orders` query, in the webhook's shape and then reduced the same way. */
export function orderFromGraphql(node: unknown): ShopifyOrder | null {
  const parsed = gqlOrder.safeParse(node);
  if (!parsed.success) return null;
  const order = parsed.data;
  const ship = order.shippingAddress;
  return orderFromWebhook({
    id: numericId(order.id),
    name: order.name,
    currency: order.currencyCode,
    line_items: order.lineItems.nodes.map((line) => ({ id: numericId(line.id), variant_id: line.variant ? numericId(line.variant.id) : null, sku: line.sku ?? "", quantity: line.quantity })),
    shipping_address: ship ? { name: ship.name, address1: ship.address1, address2: ship.address2, city: ship.city, province: ship.province, zip: ship.zip, country_code: ship.countryCodeV2, phone: ship.phone } : null,
  });
}
