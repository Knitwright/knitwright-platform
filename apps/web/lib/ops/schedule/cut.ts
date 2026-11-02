import { timingSafeEqual } from "node:crypto";

/**
 * The scheduled cut (spec F-O1, "Class A every Monday 12:00 PKT"; plan v5 O1, decision 0100).
 *
 * The cut-off is a setting in `ops_settings`, so the schedule is not the cut-off: the job runs often and the
 * database decides whether a cut-off has passed since the last run. `ops_cut_scheduled` is idempotent on the
 * cut-off it is cutting for, so a schedule that fires twice cuts one set of batches and answers "already cut"
 * the second time.
 *
 * The route is reached by the scheduler, which has no session, so a shared secret is its only door. Without
 * `CRON_SECRET` set, nothing may run the job at all: an open cut is worse than a cut that never happens.
 */

export const CRON_SECRET_MISSING = "This deploy has no cron secret set, so the scheduled cut is switched off.";
export const CRON_SECRET_WRONG = "Not found.";

export type CronAdmission = Readonly<{ ok: true }> | Readonly<{ ok: false; status: 404 | 503; reason: string }>;

const bytes = (text: string): Buffer => Buffer.from(text, "utf8");

/**
 * Whether the request carries the deploy's cron secret as `authorization: Bearer <secret>`. A deploy with no
 * secret answers 503 and says so; a wrong secret answers 404, the same as any other route a stranger finds.
 */
export function admitCron(header: string | null, secret: string | undefined): CronAdmission {
  const expected = secret?.trim() ?? "";
  if (expected.length === 0) return { ok: false, status: 503, reason: CRON_SECRET_MISSING };
  const given = (header ?? "").replace(/^Bearer /i, "").trim();
  const a = bytes(given);
  const b = bytes(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, status: 404, reason: CRON_SECRET_WRONG };
  return { ok: true };
}

export interface CutRun {
  /** The cut-off the run cut for, as an ISO time. */
  readonly cutFor: string;
  readonly ordersBatched: number;
  /** False when a run for this cut-off had already happened: nothing was cut this time. */
  readonly ran: boolean;
}

/** "Cut 4 orders for the cut-off of 2026-12-07." The sentence the route answers with and the screen shows. */
export function describeRun(run: CutRun): string {
  const when = run.cutFor.slice(0, 10);
  if (!run.ran) return `The cut-off of ${when} was already cut, so nothing was cut again.`;
  if (run.ordersBatched === 0) return `No order was waiting at the cut-off of ${when}.`;
  const pieces = run.ordersBatched === 1 ? "1 order" : `${run.ordersBatched} orders`;
  return `Cut ${pieces} for the cut-off of ${when}.`;
}
