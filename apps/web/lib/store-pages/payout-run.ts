import type { LogEvent } from "@/lib/server/core/guard";
import type { ConnectEvent } from "./connect-events";
import type { ConnectProvider } from "./connect";
import type { PayoutStore } from "./store";

/**
 * THE WEEKLY PAYOUT RUN (plan v6 C5, decision 0156; F-L5 "paid out weekly after delivery confirmation"; F-G4 "every
 * payout is reconciled against delivered orders"). The reconciliation itself is the database's
 * (`prepare_seller_payouts`): only delivered sales, their margin less refunds, less what earlier payouts paid. Here
 * each prepared payout is sent to Stripe as a transfer, one at a time, each under its own idempotency key, so a run
 * that dies part-way and runs again sends nothing twice.
 *
 * A transfer Stripe refuses marks that payout failed; its lines stop counting and next week's run pays the same
 * sales again. Without Connect set up nothing is prepared at all.
 */

export type RunDeps = Readonly<{
  store: PayoutStore;
  connect: ConnectProvider | null;
  now: () => Date;
  log: (event: LogEvent) => void;
}>;

export type RunResult = Readonly<{ prepared: number; sent: number; failed: number; skipped: boolean }>;

export async function runPayouts(deps: RunDeps): Promise<RunResult> {
  if (deps.connect === null) return { prepared: 0, sent: 0, failed: 0, skipped: true };
  const pending = await deps.store.prepare(deps.now());
  let sent = 0;
  let failed = 0;
  for (const payout of pending) {
    if (payout.provider !== deps.connect.name) continue;
    try {
      const { transferId } = await deps.connect.transfer({ payoutId: payout.id, accountId: payout.accountId, amountMinor: payout.amountMinor, currency: payout.currency });
      await deps.store.markSent(payout.id, transferId);
      sent += 1;
    } catch (error) {
      deps.log({ level: "error", message: "A seller payout could not be sent; it will be paid again next week", where: `payout ${payout.id}`, error });
      await deps.store.markFailed({ payoutId: payout.id, transferId: null }, "Stripe refused the transfer. It is tried again next week.");
      failed += 1;
    }
  }
  return { prepared: pending.length, sent, failed, skipped: false };
}

/** The run in words, for the cron's answer and the ops page. */
export const describeRun = (result: RunResult): string =>
  result.skipped
    ? "Payouts are not set up on this deploy; nothing was paid."
    : result.prepared === 0
      ? "No seller is owed a payout this week."
      : `${result.sent} of ${result.prepared} payouts sent to Stripe${result.failed > 0 ? `; ${result.failed} failed and will be tried again next week` : ""}.`;

/** What a Connect event does (C1's webhook hands it here). Every action is safe to repeat. */
export async function actOnConnect(store: PayoutStore, event: ConnectEvent): Promise<string> {
  switch (event.kind) {
    case "account":
      return (await store.updateAccount(event)) === null ? "not ours" : "account updated";
    case "bank_payout":
      return `${await store.recordBankPayout(event.accountId, event.payoutId, event.status, event.createdAt)} payouts ${event.status}`;
    case "transfer_reversed":
      await store.markFailed({ payoutId: event.payoutId, transferId: event.transferId }, "Stripe reversed the transfer. It is paid again next week.");
      return "transfer reversed";
    case "none":
      return "not a seller's";
  }
}
