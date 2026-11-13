import { z } from "zod";

/**
 * The Stripe Connect events the payouts act on (plan v6 C5, decision 0156), read into plain shapes. C1's webhook
 * (`lib/payments/events.ts`) hands these types here, so there is one endpoint and one signature check.
 *
 * - `account.updated`: what Stripe now knows about a seller's Express account (sent to the Connect endpoint, with
 *   the account named in the event's `account`).
 * - `payout.paid` / `payout.failed`: Stripe paid, or could not pay, a seller's bank from their Stripe balance.
 * - `transfer.reversed`: a transfer to a seller was taken back; the payout it made counts as failed.
 */

export type ConnectEvent =
  | Readonly<{ kind: "account"; accountId: string; detailsSubmitted: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; requirementsDue: number; disabledReason: string | null }>
  | Readonly<{ kind: "bank_payout"; accountId: string; payoutId: string; status: "paid" | "failed"; createdAt: Date | null }>
  | Readonly<{ kind: "transfer_reversed"; transferId: string; payoutId: string | null }>
  /** A payout of the platform's own balance (no connected account): not a seller's, nothing to do. */
  | Readonly<{ kind: "none" }>;

export const CONNECT_EVENT_TYPES = ["account.updated", "payout.paid", "payout.failed", "transfer.reversed"] as const;

const id = z.string().min(1).max(255);

const account = z.object({
  id,
  details_submitted: z.boolean().nullable().optional(),
  charges_enabled: z.boolean().nullable().optional(),
  payouts_enabled: z.boolean().nullable().optional(),
  requirements: z
    .object({ currently_due: z.array(z.string()).nullable().optional(), disabled_reason: z.string().nullable().optional() })
    .loose()
    .nullable()
    .optional(),
});

const payout = z.object({ id, created: z.number().int().nullable().optional() });

const transfer = z.object({ id, metadata: z.record(z.string(), z.string()).nullable().optional() });

function accountEvent(object: unknown): ConnectEvent {
  const a = account.parse(object);
  return {
    kind: "account",
    accountId: a.id,
    detailsSubmitted: a.details_submitted ?? false,
    chargesEnabled: a.charges_enabled ?? false,
    payoutsEnabled: a.payouts_enabled ?? false,
    requirementsDue: a.requirements?.currently_due?.length ?? 0,
    disabledReason: a.requirements?.disabled_reason ?? null,
  };
}

const bankPayout =
  (status: "paid" | "failed") =>
  (object: unknown, accountId: string | null): ConnectEvent => {
    if (accountId === null) return { kind: "none" };
    const p = payout.parse(object);
    return { kind: "bank_payout", accountId, payoutId: p.id, status, createdAt: p.created ? new Date(p.created * 1000) : null };
  };

function reversedEvent(object: unknown): ConnectEvent {
  const t = transfer.parse(object);
  return { kind: "transfer_reversed", transferId: t.id, payoutId: t.metadata?.payout_id ?? null };
}

const READERS: Readonly<Record<(typeof CONNECT_EVENT_TYPES)[number], (object: unknown, accountId: string | null) => ConnectEvent>> = {
  "account.updated": accountEvent,
  "payout.paid": bankPayout("paid"),
  "payout.failed": bankPayout("failed"),
  "transfer.reversed": reversedEvent,
};

const isConnectType = (type: string): type is (typeof CONNECT_EVENT_TYPES)[number] => (CONNECT_EVENT_TYPES as readonly string[]).includes(type);

/**
 * A Connect event, `null` when the type is one this reads but the body is not, and `undefined` when the type is
 * not a Connect one at all.
 */
export function readConnectEvent(type: string, object: unknown, accountId: string | null): ConnectEvent | null | undefined {
  if (!isConnectType(type)) return undefined;
  try {
    return READERS[type](object, accountId);
  } catch {
    return null;
  }
}
