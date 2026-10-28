import type { LedgerEntry } from "./ledger";
import { balanceOf } from "./ledger";
import type { OutputKind } from "./kinds";

/**
 * The credit rules as pure functions over an immutable ledger. This is the plain statement of
 * what `supabase/migrations/20261025060000_credits.sql` does, so the rules can be tested with
 * random sequences. The database is the source of truth; `tests/integration/credits.test.ts`
 * checks the same cases against it. Nothing in the app calls this to move credits.
 */

export type Ledger = readonly LedgerEntry[];

export const EMPTY_LEDGER: Ledger = [];

const spendKey = (kind: OutputKind, hash: string): string => `spend:${kind}:${hash}`;

const make = (
  fields: Pick<LedgerEntry, "id" | "kind" | "amount" | "idempotencyKey"> & Partial<LedgerEntry>,
  at: string,
): LedgerEntry => ({
  outputKind: null,
  designVersionHash: null,
  refundOf: null,
  note: "",
  createdAt: at,
  ...fields,
});

const hasKey = (ledger: Ledger, key: string): boolean => ledger.some((e) => e.idempotencyKey === key);

type Posting = Readonly<{ amount: number; key: string; id: string; at: string; note?: string }>;

export const grantCredits = (ledger: Ledger, p: Posting): { ledger: Ledger; applied: boolean } => {
  if (p.amount < 1 || hasKey(ledger, p.key)) return { ledger, applied: false };
  const entry = make({ id: p.id, kind: "grant", amount: p.amount, idempotencyKey: p.key, note: p.note ?? "" }, p.at);
  return { ledger: [...ledger, entry], applied: true };
};

export const expireCredits = (ledger: Ledger, p: Posting): { ledger: Ledger; applied: boolean } => {
  if (p.amount < 1 || p.amount > balanceOf(ledger) || hasKey(ledger, p.key)) return { ledger, applied: false };
  const entry = make({ id: p.id, kind: "expire", amount: -p.amount, idempotencyKey: p.key, note: p.note ?? "" }, p.at);
  return { ledger: [...ledger, entry], applied: true };
};

type SpendRequest = Readonly<{ kind: OutputKind; hash: string; price: number; id: string; at: string }>;

type SpendResult =
  | Readonly<{ ok: true; charged: boolean; ledger: Ledger }>
  | Readonly<{ ok: false; reason: "insufficient"; ledger: Ledger }>;

/** Charging the same output of the same saved version again costs nothing. */
export const spendCredits = (ledger: Ledger, r: SpendRequest): SpendResult => {
  const key = spendKey(r.kind, r.hash);
  if (hasKey(ledger, key) || r.price === 0) return { ok: true, charged: false, ledger };
  if (balanceOf(ledger) < r.price) return { ok: false, reason: "insufficient", ledger };
  const entry = make(
    { id: r.id, kind: "spend", amount: -r.price, idempotencyKey: key, outputKind: r.kind, designVersionHash: r.hash },
    r.at,
  );
  return { ok: true, charged: true, ledger: [...ledger, entry] };
};

type RefundRequest = Readonly<{ hash: string; ids: () => string; at: string }>;

/** Gives back every spend on a saved version that has not been given back yet. */
export const refundForVersion = (ledger: Ledger, r: RefundRequest): { ledger: Ledger; refunded: number } => {
  const open = ledger.filter(
    (e) => e.kind === "spend" && e.designVersionHash === r.hash && !hasKey(ledger, `refund:${e.id}`),
  );
  const refunds = open.map((spend) =>
    make(
      {
        id: r.ids(),
        kind: "refund",
        amount: -spend.amount,
        idempotencyKey: `refund:${spend.id}`,
        outputKind: spend.outputKind,
        designVersionHash: spend.designVersionHash,
        refundOf: spend.id,
      },
      r.at,
    ),
  );
  return { ledger: [...ledger, ...refunds], refunded: refunds.reduce((sum, e) => sum + e.amount, 0) };
};
