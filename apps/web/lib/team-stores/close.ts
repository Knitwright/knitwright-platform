import type { PaymentRow } from "@/lib/payments/store";
import { AppError } from "@/lib/server/core/errors";
import type { LogEvent } from "@/lib/server/core/guard";
import { isPaid, type StorePurchase, type TeamStore } from "./model";
import type { TeamStoreStore } from "./store";

/**
 * CLOSING A TEAM STORE (plan v6 C2, decision 0153; spec F-T6 "At close, the store becomes one order"; "If the store
 * closes below the minimum, buyers are refunded automatically").
 *
 * The team-store cron (`/api/cron/team-stores`, every 15 minutes in vercel.json) runs this for every store whose close time has come, and again for stores mid-close, so a
 * failure part-way is finished by the next run. Each step is safe to repeat:
 *
 * 1. `begin_team_store_close` counts the purchases paid at that moment, once. Met the minimum: the store is
 *    `closing` and names the one run order it becomes. Below it (or cancelled by the club): `refunding`.
 * 2. `closing`: the order goes through the make flow's door as the person who opened the store, so C1's payment
 *    gate (which accepts a closing store's own order) and D1's validation gate both run. Sent: `closed`. Refused by
 *    production: `refunding`, with production's words.
 * 3. `refunding`: every paid purchase is refunded in full through C1's refund path, then `refunded`.
 * 4. Always: a purchase paid after the count (a checkout finished after the close) is refunded.
 */

export type SentRun = Readonly<{ orderId: string; runId: string }>;

export type CloseDeps = Readonly<{
  stores: TeamStoreStore;
  /** The run order through `submit_make_order`, as the club member who opened the store. */
  submit: (store: TeamStore, who: Readonly<{ brandId: string; userId: string }>) => Promise<SentRun>;
  payment: (paymentId: string) => Promise<PaymentRow | null>;
  /** Gives back what is left of a card payment (C1's `refundPayment`). */
  refund: (payment: PaymentRow, amountMinor: number, reason: string) => Promise<void>;
  log: (event: LogEvent) => void;
}>;

export type CloseResult = Readonly<{ storeId: string; status: TeamStore["status"]; refunded: number }>;

export const NOBODY_TO_ORDER = "Nobody at the club who may order is left to place this order, so everyone who paid is refunded.";

async function refundPurchase(deps: CloseDeps, purchase: StorePurchase, reason: string): Promise<boolean> {
  const payment = await deps.payment(purchase.paymentId);
  if (payment === null || payment.method !== "card" || !["paid", "fulfilled"].includes(payment.status)) return false;
  const left = payment.amountMinor - payment.refundedMinor;
  if (left <= 0) return false;
  await deps.refund(payment, left, reason.slice(0, 300));
  return true;
}

async function refundWhere(deps: CloseDeps, store: TeamStore, which: (purchase: StorePurchase) => boolean, reason: string): Promise<number> {
  let refunded = 0;
  for (const purchase of await deps.stores.purchases(store.id)) {
    if (!isPaid(purchase) || !which(purchase)) continue;
    try {
      if (await refundPurchase(deps, purchase, reason)) refunded += 1;
    } catch (error) {
      deps.log({ level: "error", message: "A team store buyer could not be refunded; the next run tries again", where: `team store ${store.id}`, error });
    }
  }
  return refunded;
}

async function sendOrder(deps: CloseDeps, store: TeamStore): Promise<TeamStore["status"]> {
  if (store.createdBy === null) {
    await deps.stores.finishClose(store.id, "refunding", null, null, NOBODY_TO_ORDER);
    return "refunding";
  }
  try {
    const sent = await deps.submit(store, { brandId: store.brandId, userId: store.createdBy });
    await deps.stores.finishClose(store.id, "closed", sent.orderId, sent.runId, null);
    return "closed";
  } catch (error) {
    if (!(error instanceof AppError) || error.code === "internal" || error.code === "unavailable") throw error;
    await deps.stores.finishClose(store.id, "refunding", null, null, `Production refused the order: ${error.message}`);
    return "refunding";
  }
}

const LATE = "Paid after the store closed, so it was not in the club's order.";

/** Moves one store as far as it can go now. */
export async function closeStore(deps: CloseDeps, storeId: string): Promise<CloseResult> {
  let store = await deps.stores.beginClose(storeId);
  let status = store.status;
  if (status === "closing") status = await sendOrder(deps, store);
  let refunded = 0;
  if (status === "refunding") {
    store = (await deps.stores.storeById(storeId)) ?? store;
    refunded += await refundWhere(deps, store, () => true, store.closeMessage ?? "The store did not go ahead.");
    const left = (await deps.stores.purchases(store.id)).some(isPaid);
    if (!left) {
      await deps.stores.finishClose(store.id, "refunded", null, null, null);
      status = "refunded";
    }
  } else if (status === "closed" || status === "refunded") {
    refunded += await refundWhere(deps, store, (purchase) => !purchase.counted || status === "refunded", LATE);
  }
  return { storeId, status, refunded };
}

/** The cron's run: every store that needs a look, one at a time, each failure logged and left for the next run. */
export async function sweepStores(deps: CloseDeps, now: Date): Promise<readonly CloseResult[]> {
  const results: CloseResult[] = [];
  for (const id of await deps.stores.storesToSweep(now)) {
    try {
      results.push(await closeStore(deps, id));
    } catch (error) {
      deps.log({ level: "error", message: "A team store could not be closed; the next run tries again", where: `team store ${id}`, error });
    }
  }
  return results;
}
