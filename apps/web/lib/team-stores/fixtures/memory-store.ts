import { randomUUID } from "node:crypto";
import { memoryStore as memoryPayments } from "@/lib/payments/fixtures/memory-store";
import { AppError } from "@/lib/server/core/errors";
import type { StorePurchase, TeamStore } from "../model";
import { piecePriceMinor, sizesOf } from "../rules";
import type { TeamStoreStore } from "../store";
import { fixtureStore } from "./stores";

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * The team store tables in memory, over C1's in-memory payments, for the unit tests: the same moves the migration's
 * functions make that the code relies on (a purchase opens one payment per request key, the close counts the
 * purchases paid at that moment once, each close outcome moves from the state before it).
 */
export function memoryTeamStores(stores: readonly TeamStore[] = [fixtureStore()]) {
  const payments = memoryPayments();
  const rows = new Map<string, Mutable<TeamStore>>(stores.map((store) => [store.id, { ...store }]));
  const purchases: (Mutable<StorePurchase> & { storeId: string; requestKey: string })[] = [];
  const statusOf = async (paymentId: string) => (await payments.store.payment(paymentId))?.status ?? "open";
  const purchasesOf = async (storeId: string): Promise<StorePurchase[]> =>
    Promise.all(purchases.filter((one) => one.storeId === storeId).map(async (one) => ({ ...one, paymentStatus: await statusOf(one.paymentId) })));

  const store: TeamStoreStore = {
    openStore: async (input) => {
      const id = randomUUID();
      rows.set(id, { ...fixtureStore(), ...input, id, createdBy: input.userId, marginMinor: Math.floor((input.unitMinor * input.marginBps + 5000) / 10000) });
      return id;
    },
    endStore: async (_who, storeId, how) => {
      const row = rows.get(storeId);
      if (!row || row.status !== "open") throw new AppError("conflict", "That store is not open.");
      row.closesAt = new Date(0).toISOString();
      if (how === "cancel") Object.assign(row, { status: "refunding", closeMessage: "The club cancelled the store." });
    },
    storeById: async (id) => (rows.has(id) ? { ...rows.get(id)! } : null),
    storeByCode: async (code) => [...rows.values()].find((row) => row.code === code) ?? null,
    openPurchase: async (input) => {
      const row = [...rows.values()].find((one) => one.code === input.code)!;
      const existing = purchases.find((one) => one.storeId === row.id && one.requestKey === input.requestKey);
      const amountMinor = input.lines.length * piecePriceMinor(row);
      if (existing) return { paymentId: existing.paymentId, storeId: row.id, brandId: row.brandId, amountMinor: existing.amountMinor, currency: row.currency, description: `Team store: ${row.title}`, created: false };
      const paymentId = await payments.store.open({
        brandId: row.brandId, userId: "", purpose: "team_store", method: "card", currency: row.currency, orderValueMinor: amountMinor, amountMinor,
        schedule: "full", description: `Team store: ${row.title}`, credits: null, planId: null, planInterval: null, lines: [],
      });
      purchases.push({ id: randomUUID(), storeId: row.id, requestKey: input.requestKey, paymentId, buyerName: input.buyerName, buyerEmail: input.buyerEmail, pieces: input.lines.length, amountMinor, counted: false, paymentStatus: "open", lines: input.lines });
      return { paymentId, storeId: row.id, brandId: row.brandId, amountMinor, currency: row.currency, description: `Team store: ${row.title}`, created: true };
    },
    purchases: purchasesOf,
    beginClose: async (storeId) => {
      const row = rows.get(storeId)!;
      if (row.status !== "open" || Date.parse(row.closesAt) > Date.now()) return { ...row };
      const paid = (await purchasesOf(storeId)).filter((one) => ["paid", "fulfilled"].includes(one.paymentStatus));
      for (const one of purchases) if (paid.some((p) => p.id === one.id)) one.counted = true;
      const sizes = sizesOf(paid.flatMap((one) => one.lines));
      const pieces = Object.values(sizes).reduce((sum, n) => sum + n, 0);
      if (pieces >= row.minPieces) Object.assign(row, { status: "closing", closeSizes: sizes, piecesSold: pieces, closeRequestKey: `team-store:${row.id}`, marginOwedMinor: pieces * row.marginMinor });
      else Object.assign(row, { status: "refunding", piecesSold: pieces, closeMessage: `The store closed with ${pieces} of the ${row.minPieces} pieces it needed.` });
      return { ...row };
    },
    finishClose: async (storeId, status, orderId, _runId, message) => {
      const row = rows.get(storeId)!;
      if (status === "closed" && row.status === "closing") Object.assign(row, { status, orderId });
      if (status === "refunding" && row.status === "closing") Object.assign(row, { status, closeRequestKey: null, closeMessage: message });
      if (status === "refunded" && row.status === "refunding") row.status = "refunded";
    },
    storesToSweep: async () => [...rows.keys()],
    purgeBuyers: async () => 0,
  };

  /** Pays a purchase as the webhook would. */
  const pay = async (paymentId: string) => {
    await payments.store.attachSession(paymentId, "test", `cs_${paymentId}`).catch(() => undefined);
    await payments.store.markPaid(`cs_${paymentId}`, `pi_${paymentId}`, (await payments.store.payment(paymentId))!.amountMinor, "GBP");
  };

  return { store, payments, rows, purchases, pay };
}
