import { z } from "zod";
import { allowanceMonth } from "@/lib/usage/period";
import { ENTRY_KINDS, OUTPUT_KINDS, type OutputKind } from "./kinds";
import { balanceOf, withRunningBalance, type HistoryRow, type LedgerEntry } from "./ledger";
import { CREDIT_SETTINGS, type CreditSettingsShape } from "./settings";

/**
 * The credit API. The database moves credits (supabase/migrations/20261025060000_credits.sql);
 * this module calls it and reads the answers. Only the server's own key may call the functions.
 *
 * Credits are not the beta usage caps (decision 0012): a cap limits what the platform pays for AI
 * calls, credits are what a brand spends. A spend that pays for a metered call carries that call's
 * usage event id, so the two records join.
 */

export type CreditsDb = Readonly<{
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  /** The latest `limit` ledger lines of the brand, oldest first, as stored. */
  readLedger: (brandId: string, limit: number) => Promise<readonly unknown[]>;
  /** The numbers in force: the settings.ts placeholders with any the owner set in the console laid over them (lib/settings). Omitted, the placeholders. */
  readSettings?: () => Promise<CreditSettingsShape>;
}>;

/** How many lines the credits page shows. */
export const HISTORY_LIMIT = 200;

const FAILED = "The credits could not be read or changed.";

const spendAnswer = z.union([
  z.object({ ok: z.literal(true), charged: z.boolean(), price: z.number(), balance: z.number(), entry_id: z.string().nullable() }),
  z.object({ ok: z.literal(false), reason: z.literal("insufficient"), price: z.number(), balance: z.number() }),
]);
const refundAnswer = z.object({ refunded: z.number(), balance: z.number() });
const grantAnswer = z.object({ applied: z.boolean(), balance: z.number() });

const rowSchema = z.object({
  id: z.string(),
  kind: z.enum(ENTRY_KINDS),
  amount: z.number().int(),
  output_kind: z.enum(OUTPUT_KINDS).nullable(),
  design_version_hash: z.string().nullable(),
  refund_of: z.string().nullable(),
  idempotency_key: z.string(),
  note: z.string(),
  created_at: z.string(),
});

const toEntry = (row: z.infer<typeof rowSchema>): LedgerEntry => ({
  id: row.id,
  kind: row.kind,
  amount: row.amount,
  outputKind: row.output_kind,
  designVersionHash: row.design_version_hash,
  refundOf: row.refund_of,
  idempotencyKey: row.idempotency_key,
  note: row.note,
  createdAt: row.created_at,
});

export type SpendInput = Readonly<{
  brandId: string;
  userId: string;
  kind: OutputKind;
  /** The saved version of the design the output is made from. */
  designVersionHash: string;
  /** The usage_events row of the paid call this spend pays for, if there is one. */
  usageEventId?: string;
}>;

export type SpendOutcome =
  | Readonly<{ ok: true; charged: boolean; price: number; balance: number; entryId: string | null }>
  | Readonly<{ ok: false; reason: "insufficient"; price: number; balance: number }>;

export type CreditSummary = Readonly<{
  balance: number;
  history: readonly HistoryRow[];
  prices: Readonly<Record<OutputKind, number>>;
  /** True while the prices and the monthly allowance are the placeholders of settings.ts. */
  isPlaceholder: boolean;
  monthlyAllowance: number;
}>;

export type CreditsService = ReturnType<typeof createCreditsService>;

type Call = <T>(fn: string, args: Record<string, unknown>, schema: z.ZodType<T>) => Promise<T>;
type Settings = () => Promise<CreditSettingsShape>;

const requireHash = (hash: string): string => {
  if (hash.trim().length === 0) throw new Error("A design version is needed to charge or give back credits.");
  return hash;
};

/**
 * Charges the price of an output, once per output kind and design version: asking again for
 * the same output costs nothing. Refused, without changing anything, when the balance is short.
 */
const spendOperation = (call: Call) => async (input: SpendInput): Promise<SpendOutcome> => {
  const answer = await call(
    "credit_spend",
    {
      p_brand_id: input.brandId,
      p_user_id: input.userId,
      p_kind: input.kind,
      p_version_hash: requireHash(input.designVersionHash),
      p_usage_event_id: input.usageEventId ?? null,
    },
    spendAnswer,
  );
  return answer.ok
    ? { ok: true, charged: answer.charged, price: answer.price, balance: answer.balance, entryId: answer.entry_id }
    : answer;
};

/**
 * Gives back every spend on a design version, once. For the code that moves a design to
 * "ordered" to call (V1 owns the status, V5 the order); nothing calls it yet.
 */
const refundOperation = (call: Call) => (input: Readonly<{ brandId: string; designVersionHash: string }>) =>
  call("credit_refund_for_order", { p_brand_id: input.brandId, p_version_hash: requireHash(input.designVersionHash) }, refundAnswer);

/** The brand's free credits for the month `now` falls in, given once. */
const allowanceOperation = (call: Call, settings: Settings) => async (brandId: string, now: Date) =>
  call(
    "credit_ensure_allowance",
    { p_brand_id: brandId, p_month: allowanceMonth(now), p_amount: (await settings()).monthlyAllowance },
    grantAnswer,
  );

/** Writes the prices of settings.ts to the database. Run it after changing them. */
const syncOperation = (call: Call, settings: Settings) => async (): Promise<void> => {
  const current = await settings();
  await call("credit_set_prices", { p_prices: current.prices, p_placeholder: current.isPlaceholder }, z.null());
};

const summaryOperation = (db: CreditsDb, call: Call, settings: Settings) => async (brandId: string): Promise<CreditSummary> => {
  const [balance, lines, current] = await Promise.all([
    call("credit_balance", { p_brand_id: brandId }, z.number()),
    db.readLedger(brandId, HISTORY_LIMIT),
    settings(),
  ]);
  const parsed = z.array(rowSchema).safeParse(lines);
  if (!parsed.success) throw new Error(FAILED, { cause: parsed.error });
  const entries = parsed.data.map(toEntry);
  return {
    balance,
    history: withRunningBalance(entries, balance - balanceOf(entries)),
    prices: current.prices,
    isPlaceholder: current.isPlaceholder,
    monthlyAllowance: current.monthlyAllowance,
  };
};

export const createCreditsService = (db: CreditsDb) => {
  const settings: Settings = () => (db.readSettings ? db.readSettings() : Promise.resolve(CREDIT_SETTINGS));
  const call: Call = async (fn, args, schema) => {
    const { data, error } = await db.rpc(fn, args);
    const parsed = error ? null : schema.safeParse(data);
    if (!parsed?.success) throw new Error(FAILED, { cause: error ?? data });
    return parsed.data;
  };
  return {
    spendCredits: spendOperation(call),
    refundForOrder: refundOperation(call),
    ensureMonthlyAllowance: allowanceOperation(call, settings),
    syncCreditPrices: syncOperation(call, settings),
    summary: summaryOperation(db, call, settings),
  };
};
