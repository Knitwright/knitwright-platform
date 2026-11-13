/**
 * The one seam to Shopify (plan v6 C4, decision 0155). `graphql.ts` is the real Admin API client, used only when
 * the owner's Partner app keys are set; `stand-in.ts` answers wherever SHOPIFY_APP_TEST_MODE is on (the browser
 * tests, a local run) and never reaches the network. Nothing else in the app talks to Shopify.
 */

export type ShipTo = Readonly<{
  name: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  phone: string;
}>;

export type ShopifyOrderLine = Readonly<{ id: string; variantId: string | null; sku: string; quantity: number }>;

/** An order as both the webhook and the API give it, reduced to what Knitwright needs to make and ship it. */
export type ShopifyOrder = Readonly<{
  id: string;
  name: string;
  currency: string;
  lines: readonly ShopifyOrderLine[];
  shipTo: ShipTo | null;
}>;

export type ProductToPush = Readonly<{
  /** Shopify's product id when this product was pushed before, so a second push updates it. */
  existingProductId: string | null;
  title: string;
  description: string;
  /** One variant per size. */
  variants: readonly Readonly<{ size: string; sku: string; priceMinor: number }>[];
  currency: "GBP" | "AUD";
  /** The fulfilment-service location the variants are stocked at, so Shopify sends their orders to Knitwright. */
  locationId: string | null;
}>;

export type PushedProduct = Readonly<{
  productId: string;
  variants: readonly Readonly<{ size: string; variantId: string; sku: string }>[];
}>;

export type Shop = Readonly<{ shop: string; accessToken: string }>;

export interface ShopifyAdmin {
  readonly name: "shopify" | "stand-in";
  /** Swaps the OAuth return's code for an offline access token. */
  exchangeCode(shop: string, code: string): Promise<Readonly<{ accessToken: string; scope: string }>>;
  /** Registers Knitwright as the shop's fulfilment service; answers its location. */
  registerFulfilmentService(shop: Shop, callbackUrl: string): Promise<Readonly<{ locationId: string }>>;
  /** Subscribes the shop's paid orders and the app's uninstall to our webhook address. */
  registerWebhooks(shop: Shop, address: string): Promise<void>;
  pushProduct(shop: Shop, product: ProductToPush): Promise<PushedProduct>;
  /** Paid orders updated since the given time, newest last. */
  paidOrdersSince(shop: Shop, since: Date): Promise<readonly ShopifyOrder[]>;
  /** Accepts every fulfilment request waiting for Knitwright; answers how many. */
  acceptFulfilmentRequests(shop: Shop): Promise<number>;
  /** Marks the order's lines at Knitwright's location fulfilled, with the parcel's tracking. */
  sendTracking(shop: Shop, input: Readonly<{ orderId: string; courier: string; trackingNumber: string }>): Promise<void>;
}

/** Thrown when Shopify answers with an error. The message is for a log, never a person, and never holds a token. */
export class ShopifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopifyError";
  }
}

/** What the app asks a shop for: products, its orders, fulfilment of what is assigned to us, and our location. */
export const SHOPIFY_SCOPES = [
  "write_products",
  "read_orders",
  "write_fulfillments",
  "write_assigned_fulfillment_orders",
  "write_inventory",
  "read_locations",
] as const;

/** The webhook topics registered on install. The privacy ones are set in the Partner app (runbook). */
export const SHOPIFY_WEBHOOK_TOPICS = ["ORDERS_PAID", "APP_UNINSTALLED"] as const;
