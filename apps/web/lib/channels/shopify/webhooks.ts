import { z } from "zod";
import type { LogEvent } from "@/lib/server/core/guard";
import type { IntakeDeps } from "../intake";
import { verifyBody, shopDomain } from "./hmac";
import { orderFromWebhook } from "./order-payload";
import { takeShopifyOrder } from "./orders";

/**
 * Shopify's webhooks (plan v6 C4, decision 0155), one address for every topic. Nothing is read until the raw
 * body's `X-Shopify-Hmac-Sha256` checks against the app secret and the shop header is a myshopify domain.
 *
 * - `orders/paid`: the order is taken in (`orders.ts`). A failure answers 500, so Shopify sends it again; taking
 *   an order twice does nothing new.
 * - `app/uninstalled`: the connection ends and its token is dropped.
 * - `customers/data_request`, `customers/redact`, `shop/redact`: Shopify's mandatory privacy webhooks. The only
 *   buyer data kept is each order line's ship-to address; a redaction clears it, a data request is logged for ops
 *   to answer from the channel orders (runbook).
 *
 * Any other topic is acknowledged and ignored.
 */

export type WebhookAnswer = Readonly<{ status: number; message: string }>;

export type WebhookDeps = IntakeDeps &
  Readonly<{
    secret: string;
    log: (event: LogEvent) => void;
  }>;

export type WebhookHeaders = Readonly<{ hmac: string | null; topic: string | null; shop: string | null }>;

const redactBody = z.object({ orders_to_redact: z.array(z.union([z.number(), z.string()]).transform(String)).max(1000).optional() });

const ok = (message: string): WebhookAnswer => ({ status: 200, message });

export async function receiveShopifyWebhook(deps: WebhookDeps, raw: string, headers: WebhookHeaders): Promise<WebhookAnswer> {
  if (!verifyBody(deps.secret, raw, headers.hmac)) return { status: 401, message: "The signature does not match." };
  const shop = shopDomain(headers.shop ?? "");
  if (shop === null || shop !== headers.shop) return { status: 400, message: "No shop." };
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { status: 400, message: "The body is not JSON." };
  }

  switch (headers.topic) {
    case "orders/paid":
      return paidOrder(deps, shop, body);
    case "app/uninstalled": {
      const ended = await deps.store.uninstalled(shop);
      return ok(ended ? "Disconnected." : "No connection.");
    }
    case "customers/redact": {
      const parsed = redactBody.safeParse(body);
      const count = await deps.store.redactCustomer(shop, parsed.success ? (parsed.data.orders_to_redact ?? []) : []);
      return ok(`Redacted ${count}.`);
    }
    case "shop/redact": {
      const count = await deps.store.redactShop(shop);
      return ok(`Redacted ${count}.`);
    }
    case "customers/data_request":
      deps.log({ level: "warn", message: "Shopify customer data request: answer within 30 days from the channel orders (runbook)", where: `shopify ${shop}` });
      return ok("Recorded.");
    default:
      return ok("Ignored.");
  }
}

async function paidOrder(deps: WebhookDeps, shop: string, body: unknown): Promise<WebhookAnswer> {
  const order = orderFromWebhook(body);
  if (order === null) return { status: 400, message: "Not an order." };
  const connection = await deps.store.secretByShop(shop);
  if (connection === null) return ok("No connection.");
  try {
    const result = await takeShopifyOrder(deps, connection, order);
    return ok(`Received ${result.received}, sent ${result.submitted}, refused ${result.refused}.`);
  } catch (error) {
    deps.log({ level: "error", message: "A Shopify order could not be taken in", where: `shopify ${shop} order ${order.id}`, error });
    return { status: 500, message: "Try again." };
  }
}
