import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ORDER_STATUSES } from "./status";

/**
 * The one door an order goes through into production (decision 0043). The platform has no payment
 * concept; the owner's separate Store calls `public.submit_order_for_production` with the server's own
 * key once it holds an order it wants made. Nothing else writes `ops_orders`.
 *
 * What the Store gives:
 *   release_id         a frozen release (production_releases). The brand, design, roster hash and file
 *                      hashes are read from it, never taken from the caller.
 *   external_ref       the Store's own order reference, 1 to 120 characters. The key for retries: the same
 *                      reference with the same release answers with the order already there (created: false);
 *                      the same reference with another release is refused (external_ref_conflict).
 *   factory_profile_id which factory makes it, as a text id (V1's factory profile when it lands).
 *   fabric_key         which fabric, as a text id. Orders batch by factory, fabric and article.
 *   article_id         the garment article, such as "team-jersey".
 *   sizes              {size label: pieces}, 1 to 40 sizes, each 1 to 99,999. Pieces is their sum.
 *   value_minor        optional: the Store's price for the order in minor units (cents) ...
 *   currency           ... with its ISO 4217 code. Both or neither. The platform stores them and never
 *                      sets a price itself.
 *
 * What it answers: the order id, its status ("submitted", waiting for the next batch), the cut-off it falls
 * under (the next weekly cut-off at or after now, ops_settings), the promised date (cut-off date plus the
 * lead time; null while no lead time is set, because none is invented), and whether the row is new.
 *
 * Refusals (a Postgres error with `hint`): release_not_found, external_ref_conflict, invalid_sizes,
 * invalid_value. A retry after any other failure is safe.
 */
export const SUBMIT_ORDER_FUNCTION = "submit_order_for_production";

export const SIZES_MAX = 40;
export const PIECES_PER_SIZE_MAX = 99_999;

const sizeLabel = z.string().min(1).max(16).refine((s) => s.trim() === s && !/\p{C}/u.test(s), "A size label has no spaces at the ends and no control characters.");
export const sizesSchema = z
  .record(sizeLabel, z.number().int().min(1).max(PIECES_PER_SIZE_MAX))
  .refine((r) => Object.keys(r).length >= 1 && Object.keys(r).length <= SIZES_MAX, `Give between 1 and ${SIZES_MAX} sizes.`);

const idText = z.string().trim().min(1).max(120);

export const submitOrderInputSchema = z
  .object({
    releaseId: z.uuid(),
    externalRef: idText,
    factoryProfileId: idText,
    fabricKey: idText,
    articleId: idText,
    sizes: sizesSchema,
    valueMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().default(null),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable().default(null),
  })
  .refine((o) => (o.valueMinor === null) === (o.currency === null), "A value and its currency come together or not at all.");
export type SubmitOrderInput = z.input<typeof submitOrderInputSchema>;

export const submitOrderResultSchema = z.object({
  order_id: z.uuid(),
  status: z.enum(ORDER_STATUSES),
  cutoff_at: z.string(),
  promised_on: z.string().nullable(),
  lead_time_days: z.number().int().nullable(),
  created: z.boolean(),
});

export interface SubmittedOrder {
  readonly orderId: string;
  readonly status: (typeof ORDER_STATUSES)[number];
  readonly cutoffAt: string;
  readonly promisedOn: string | null;
  readonly leadTimeDays: number | null;
  readonly created: boolean;
}

export type SubmitOrderErrorCode = "release_not_found" | "external_ref_conflict" | "invalid_sizes" | "invalid_value" | "invalid_input" | "unexpected_answer" | "database";
const KNOWN_HINTS: readonly SubmitOrderErrorCode[] = ["release_not_found", "external_ref_conflict", "invalid_sizes", "invalid_value"];

export class SubmitOrderError extends Error {
  override readonly name = "SubmitOrderError";
  constructor(
    readonly code: SubmitOrderErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Calls the function with a client holding the server's own key. A typed wrapper for tests and for the Store's author to read. */
export async function submitOrderForProduction(admin: Pick<SupabaseClient, "rpc">, input: SubmitOrderInput): Promise<SubmittedOrder> {
  const parsed = submitOrderInputSchema.safeParse(input);
  if (!parsed.success) throw new SubmitOrderError("invalid_input", parsed.error.issues[0]?.message ?? "The order is not valid.");
  const o = parsed.data;
  const { data, error } = await admin.rpc(SUBMIT_ORDER_FUNCTION, {
    p_release_id: o.releaseId,
    p_external_ref: o.externalRef,
    p_factory_profile_id: o.factoryProfileId,
    p_fabric_key: o.fabricKey,
    p_article_id: o.articleId,
    p_sizes: o.sizes,
    p_value_minor: o.valueMinor,
    p_currency: o.currency,
  });
  if (error) {
    const hint = KNOWN_HINTS.find((h) => h === error.hint);
    throw new SubmitOrderError(hint ?? "database", error.message);
  }
  const row = submitOrderResultSchema.safeParse(Array.isArray(data) ? data[0] : data);
  if (!row.success) throw new SubmitOrderError("unexpected_answer", "The database answered in a shape the contract does not describe.");
  const r = row.data;
  return { orderId: r.order_id, status: r.status, cutoffAt: new Date(r.cutoff_at).toISOString(), promisedOn: r.promised_on, leadTimeDays: r.lead_time_days, created: r.created };
}
