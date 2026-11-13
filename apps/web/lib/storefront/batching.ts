import { AppError } from "@/lib/server/core/errors";

/**
 * MADE-TO-ORDER AND DROP BATCHES (spec F-L5 "single sales accumulate and join the weekly batch"; "at close the drop
 * becomes one Class A or B batch"; F-O1 "Class A every Monday 12:00 PKT").
 *
 * A storefront never sends a shopper's order to production by itself. At each cut-off the paid, unbatched orders
 * of one listing become one batch (`cut_storefront_batch`), and the batch is sent as ONE order through the brand
 * run door, exactly as the brand would send it: the order checks (sizes, stage, fabric), the moderation screen and
 * the D1 validation gate (decision 0132), then `submit_brand_run`, whose payment gate (decision 0152) finds the
 * batch's payment line. A batch the door refuses is marked refused and every shopper in it is refunded in full,
 * because nobody pays for something that never reaches the factory.
 */

/** Pakistan Standard Time has no daylight saving: 12:00 PKT is 07:00 UTC, all year. */
const CUTOFF_UTC_HOUR = 7;
const MONDAY = 1;
const DAY = 86_400_000;

/** The most recent Monday 12:00 PKT at or before `now`. */
export function latestCutoff(now: Date): Date {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), CUTOFF_UTC_HOUR));
  const back = (day.getUTCDay() - MONDAY + 7) % 7;
  const monday = new Date(day.getTime() - back * DAY);
  return monday.getTime() <= now.getTime() ? monday : new Date(monday.getTime() - 7 * DAY);
}

/** The next Monday 12:00 PKT after `now`: when the shoppers' made-to-order sales go to the factory. */
export const nextCutoff = (now: Date): Date => new Date(latestCutoff(now).getTime() + 7 * DAY);

export interface BatchToSend {
  readonly id: string;
  readonly brandId: string;
  readonly listingId: string;
  readonly sizes: Readonly<Record<string, number>>;
}

export type BatchOutcome =
  | Readonly<{ status: "sent"; orderId: string }>
  | Readonly<{ status: "refused"; message: string }>;

export type SendDeps = Readonly<{
  /** Sends the batch through the brand run door; throws an AppError in plain words when it is refused before payment. */
  order: (batch: BatchToSend) => Promise<BatchOutcome>;
  settle: (batchId: string, outcome: BatchOutcome) => Promise<void>;
  /** Refunds every shopper of the batch in full. */
  refundAll: (batchId: string, reason: string) => Promise<void>;
}>;

/**
 * Sends one batch and settles it. A refusal (by the app's own checks or by the database) refunds every shopper.
 * A fault (the network, the database down) is thrown, leaving the batch open so the next run tries again.
 */
export async function sendBatch(deps: SendDeps, batch: BatchToSend): Promise<BatchOutcome> {
  let outcome: BatchOutcome;
  try {
    outcome = await deps.order(batch);
  } catch (error) {
    if (!(error instanceof AppError) || error.code === "internal" || error.code === "unavailable") throw error;
    outcome = { status: "refused", message: error.message };
  }
  await deps.settle(batch.id, outcome);
  if (outcome.status === "refused") await deps.refundAll(batch.id, `Not sent to production: ${outcome.message}`.slice(0, 300));
  return outcome;
}

export interface RunSummary {
  readonly closedDrops: number;
  readonly batches: number;
  readonly sent: number;
  readonly refused: number;
  readonly failed: number;
}

/** One line for the cron's answer and the log. */
export const describeRun = (run: RunSummary): string =>
  `${run.closedDrops} drops closed; ${run.batches} batches: ${run.sent} sent, ${run.refused} refused, ${run.failed} to retry.`;

export const BATCH_STATUS_LABELS = { open: "Waiting to send", sent: "Sent to production", refused: "Refused, shoppers refunded" } as const;
