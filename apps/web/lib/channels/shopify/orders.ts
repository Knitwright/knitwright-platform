import { takeOrder, type IntakeDeps, type IntakeResult, type ResolvedLine } from "../intake";
import type { ConnectionSecret } from "../store";
import type { ShopifyOrder } from "./admin";

/**
 * A Shopify order, from the webhook or a pull, matched to the brand's listings and taken in (plan v6 C4, decision
 * 0155). A line whose variant Knitwright did not list (the shop's own stock) is not ours, and is left alone.
 */

const SAFE_ID = /^[A-Za-z0-9_-]{1,40}$/;

export async function resolveShopifyOrder(deps: IntakeDeps, connection: ConnectionSecret, order: ShopifyOrder): Promise<readonly ResolvedLine[]> {
  if (!SAFE_ID.test(order.id)) return [];
  const lines: ResolvedLine[] = [];
  for (const line of order.lines) {
    if (line.variantId === null || !SAFE_ID.test(line.id)) continue;
    const listing = await deps.store.listingByVariant(connection.id, line.variantId);
    if (!listing) continue;
    lines.push({
      brandId: connection.brandId,
      channel: "shopify",
      connectionId: connection.id,
      externalOrderId: order.id,
      externalLineId: line.id,
      orderName: order.name.slice(0, 80),
      productId: listing.productId,
      sizeLabel: listing.sizeLabel,
      pieces: line.quantity,
      shipTo: order.shipTo,
      projectId: listing.projectId,
      releaseId: listing.releaseId,
      factoryProfileId: listing.factoryProfileId,
      fabricKey: listing.fabricKey,
      flags: listing.flags,
    });
  }
  return lines;
}

const NOTHING: IntakeResult = { received: 0, submitted: 0, refused: 0, messages: [] };

export async function takeShopifyOrder(deps: IntakeDeps, connection: ConnectionSecret, order: ShopifyOrder): Promise<IntakeResult> {
  const lines = await resolveShopifyOrder(deps, connection, order);
  if (lines.length === 0) return NOTHING;
  return takeOrder(deps, {
    brandId: connection.brandId,
    actor: connection.connectedBy,
    description: `Shopify order ${order.name} from ${connection.shop}`,
    currency: order.currency,
    lines,
  });
}

/** Adds up the results of several orders. */
export const sumResults = (results: readonly IntakeResult[]): IntakeResult =>
  results.reduce(
    (sum, one) => ({ received: sum.received + one.received, submitted: sum.submitted + one.submitted, refused: sum.refused + one.refused, messages: [...new Set([...sum.messages, ...one.messages])] }),
    NOTHING,
  );
