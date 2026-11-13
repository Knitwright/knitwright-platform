import { AppError } from "@/lib/server/core/errors";
import type { LogEvent } from "@/lib/server/core/guard";
import type { LineRow, PaymentRow, PaymentsStore } from "./store";

/**
 * FULFILMENT (plan v6 C1, decision 0152): what happens once a payment is paid, or straight away for an invoice.
 *
 * Each waiting line is sent to production through its own door (`submit_make_order` or `submit_brand_run`), as the
 * person who paid. The database checks the payment again (`payment_required`), then the D1 validation gate, the
 * golden sample and the stage. A line the database refuses is marked refused with its words, and a card payment
 * gives that line's share back at once: nobody pays for an order that never reaches the factory.
 *
 * After a line is sent, the credits spent on that design version are given back as order credit (decision 0132
 * owner question D1-3, which the spec answers yes: "Credits spent on a design come back as order credit when you
 * order it"). That refund is best-effort: the order stands if it fails, it is logged, and the database gives each
 * spend back once, so a later order of the same version finishes the job.
 *
 * Fulfilling twice does nothing new: a settled line is skipped, and the door answers a repeated request key with the
 * order it already made.
 */

export type SubmittedOrder = Readonly<{ orderId: string; runId: string; status: string }>;

export type FulfilDeps = Readonly<{
  store: PaymentsStore;
  submit: (line: LineRow, who: Readonly<{ brandId: string; userId: string }>) => Promise<SubmittedOrder>;
  /** Gives back the credits spent on the line's design version. */
  creditsBack: (line: LineRow, brandId: string) => Promise<void>;
  /** Gives back part of a card payment (`refunds.ts`). */
  refund: (payment: PaymentRow, amountMinor: number, reason: string) => Promise<void>;
  log: (event: LogEvent) => void;
}>;

export type LineOutcome = Readonly<{ lineId: string; status: LineRow["status"]; orderId: string | null; message: string | null }>;

export type Fulfilment = Readonly<{ paymentId: string; status: PaymentRow["status"] | "missing"; lines: readonly LineOutcome[] }>;

const READY = new Set<PaymentRow["status"]>(["paid", "invoice", "fulfilled"]);

/** A refused line's share of what the card was charged: its value where paid in full, its part of a deposit otherwise. */
export function refundShare(payment: PaymentRow, line: LineRow): number {
  if (payment.method !== "card" || line.valueMinor === null || !payment.orderValueMinor) return 0;
  const share = payment.schedule === "full" ? line.valueMinor : Math.floor((payment.amountMinor * line.valueMinor) / payment.orderValueMinor);
  return Math.max(0, Math.min(share, payment.amountMinor - payment.refundedMinor));
}

const outcomeOf = (line: LineRow): LineOutcome => ({ lineId: line.id, status: line.status, orderId: line.orderId, message: line.message });

async function sendLine(deps: FulfilDeps, payment: PaymentRow, line: LineRow): Promise<LineOutcome> {
  const who = { brandId: payment.brandId ?? "", userId: payment.createdBy ?? "" };
  try {
    const sent = await deps.submit(line, who);
    await deps.store.settleLine(line.id, "submitted", sent.orderId, sent.runId, null);
    await deps.creditsBack(line, who.brandId).catch((error: unknown) =>
      deps.log({ level: "error", message: "Credits could not be given back for an ordered design", where: `payment ${payment.id}`, error }),
    );
    return { lineId: line.id, status: "submitted", orderId: sent.orderId, message: null };
  } catch (error) {
    if (!(error instanceof AppError) || error.code === "internal" || error.code === "unavailable") throw error;
    await deps.store.settleLine(line.id, "refused", null, null, error.message);
    const share = refundShare(await currentOf(deps, payment), line);
    if (share > 0) await deps.refund(payment, share, `Not sent to production: ${error.message}`.slice(0, 300));
    return { lineId: line.id, status: "refused", orderId: null, message: error.message };
  }
}

const currentOf = async (deps: FulfilDeps, payment: PaymentRow): Promise<PaymentRow> => (await deps.store.payment(payment.id)) ?? payment;

/** Sends every waiting line of a paid or invoice payment, and marks the payment fulfilled. */
export async function fulfilPayment(deps: FulfilDeps, paymentId: string): Promise<Fulfilment> {
  const payment = await deps.store.payment(paymentId);
  if (!payment) return { paymentId, status: "missing", lines: [] };
  if (!READY.has(payment.status) || payment.purpose !== "order") return { paymentId, status: payment.status, lines: [] };
  const outcomes: LineOutcome[] = [];
  for (const line of await deps.store.lines(paymentId)) {
    outcomes.push(line.status === "waiting" ? await sendLine(deps, payment, line) : outcomeOf(line));
  }
  await deps.store.finish(paymentId);
  return { paymentId, status: (await deps.store.payment(paymentId))?.status ?? payment.status, lines: outcomes };
}

/** The refusals of a fulfilment, in one sentence for the person, or null when every line was sent. */
export const refusalsOf = (fulfilment: Fulfilment): string | null => {
  const refused = fulfilment.lines.filter((line) => line.status === "refused").map((line) => line.message ?? "Refused.");
  return refused.length === 0 ? null : [...new Set(refused)].join(" ");
};
