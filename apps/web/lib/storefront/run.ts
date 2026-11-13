import "server-only";
import { placeOrder } from "@/lib/brand-runs/place-order";
import { isClubRole } from "@/lib/clubs/roles";
import { orderValidationGate } from "@/lib/make/order-gate";
import { humanReviewGate, orderGate } from "@/lib/moderation/server";
import { refundable, refundPayment } from "@/lib/payments/refunds";
import { fulfil, payments, paymentsStore } from "@/lib/payments/server";
import { AppError } from "@/lib/server/core/errors";
import { adminClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import { latestCutoff, sendBatch, type BatchOutcome, type BatchToSend, type RunSummary } from "./batching";
import { syncShopSales } from "./sales-server";
import { closeDueDrops, cutBatch, dropListingIds, listingById, listingsWaiting, openBatchPayment, openBatches, readStorefront, roleOf, settleBatch, shopOrdersOfBatch } from "./db";

/**
 * The storefront's batches, run (plan v6 C3, decision 0154): by the scheduler every hour, and by a brand's own
 * "Send now" on its storefront page. Each batch goes to production as one order through the brand run door
 * (`placeOrder`: the order checks, the moderation screen and the D1 validation gate), under a payment line the
 * database opens only when every shopper in the batch has paid, then through C1's `fulfil`, so `submit_brand_run`'s
 * payment gate decides it. The rules are in `batching.ts`; the database and browser tests cover these joins.
 */

const BATCH_COUNTRY = { GBP: "GB", AUD: "AU" } as const;

/** One batch, sent as the storefront's batch owner. */
async function orderBatch(batch: BatchToSend): Promise<BatchOutcome> {
  const admin = adminClient();
  const [listing, storefront] = await Promise.all([listingById(admin, batch.listingId), readStorefront(admin, batch.brandId)]);
  if (listing === null || listing.releaseId === null || listing.fabricKey === null) throw new AppError("conflict", "The listing no longer names what to make.");
  const owner = storefront?.batchOwner ?? null;
  const role = owner ? await roleOf(admin, batch.brandId, owner) : null;
  if (owner === null || !isClubRole(role)) throw new AppError("conflict", "Nobody who may order for this brand put the storefront live. Put it live again.");
  const who = { brandId: batch.brandId, userId: owner };
  const { data: brand } = await admin.from("brands").select("name").eq("id", batch.brandId).maybeSingle();
  const body = { productId: listing.productId, kind: "run" as const, releaseId: listing.releaseId, fabricKey: listing.fabricKey, quantities: batch.sizes, acknowledgeFlags: true, requestKey: `storefront-${batch.id}` };
  return placeOrder(
    { client: admin, admin },
    who,
    role,
    body,
    { order: orderGate(who, "storefront batch"), humanReview: humanReviewGate() },
    orderValidationGate({ client: admin, admin, who, brandName: (brand as { name?: string } | null)?.name ?? "", country: BATCH_COUNTRY[listing.currency] }),
    async (run) => {
      const paymentId = await openBatchPayment(admin, batch.id, owner, {
        request_key: run.requestKey, product_id: run.productId, project_id: run.projectId, release_id: run.releaseId,
        factory_profile_id: run.factoryProfileId, fabric_key: run.fabricKey, sizes: run.sizes, flags: run.flags,
      });
      const line = (await fulfil(paymentId)).lines[0];
      if (line?.status === "submitted" && line.orderId) return { status: "sent", orderId: line.orderId } as const;
      return { status: "refused", message: line?.message ?? "Production did not take the batch." } as const;
    },
  );
}

/** Every shopper of a refused batch gets their whole payment back. */
async function refundAll(batchId: string, reason: string): Promise<void> {
  const store = paymentsStore();
  const provider = payments()?.provider ?? null;
  for (const order of await shopOrdersOfBatch(adminClient(), batchId)) {
    const payment = await store.payment(order.paymentId);
    const left = payment ? refundable(payment) : 0;
    if (payment === null || left <= 0) continue;
    await refundPayment({ store, provider }, payment, left, reason, null).catch((error: unknown) =>
      log({ level: "error", message: "A storefront refund failed; refund it from ops finance", where: `payment ${payment.id}`, error }),
    );
  }
}

const sendDeps = {
  order: orderBatch,
  settle: (batchId: string, outcome: BatchOutcome) =>
    settleBatch(adminClient(), batchId, outcome.status, outcome.status === "sent" ? outcome.orderId : null, outcome.status === "refused" ? outcome.message : null),
  refundAll,
};

/** Cuts what is due and sends every open batch. For the scheduler (all brands) or one brand's "Send now". */
export async function runStorefrontBatches(now: Date, brandId?: string, cutoff: Date = latestCutoff(now)): Promise<RunSummary> {
  const admin = adminClient();
  const closed = (await closeDueDrops(admin, now)).filter((drop) => brandId === undefined || drop.brandId === brandId);
  const inDrops = await dropListingIds(admin, closed.map((drop) => drop.id));
  for (const drop of closed) for (const listingId of inDrops.get(drop.id) ?? []) await cutBatch(admin, listingId, drop.id, new Date(drop.closesAt));
  for (const listingId of await listingsWaiting(admin, brandId)) await cutBatch(admin, listingId, null, cutoff);

  const batches = await openBatches(admin, brandId);
  let sent = 0;
  let refused = 0;
  let failed = 0;
  for (const batch of batches) {
    if (batch.brandId === null || batch.listingId === null) continue;
    try {
      const outcome = await sendBatch(sendDeps, { id: batch.id, brandId: batch.brandId, listingId: batch.listingId, sizes: batch.sizes });
      if (outcome.status === "sent") sent += 1;
      else refused += 1;
    } catch (error) {
      failed += 1;
      log({ level: "error", message: "A storefront batch could not be sent; the next run tries again", where: `batch ${batch.id}`, error });
    }
  }
  // C5's payouts: every paid sale, the order its batch went in, and any refund (decision 0156). Safe to repeat.
  await syncShopSales(brandId).catch((error: unknown) => log({ level: "error", message: "Storefront sales could not be recorded for payouts", where: "storefront batches", error }));
  return { closedDrops: closed.length, batches: batches.length, sent, refused, failed };
}
