import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refusal } from "@/lib/make/service";
import { toPayout, type PayoutStore } from "./store";

/**
 * The payout tables through the server's key (migration 20261228040000). Every write is one of the migration's
 * functions; a refusal comes back as an AppError in the database's words. The database tests cover this file
 * (`tests/integration/store-payouts.test.ts`).
 */

type Answer<T> = Readonly<{ data: T | null; error: Readonly<{ code?: string; hint?: string | null; message: string }> | null }>;

const must = <T>(answer: Answer<T>, missing = "That payout does not exist."): T | null => {
  if (answer.error) throw refusal(answer.error, missing);
  return answer.data;
};

export function supabasePayouts(admin: SupabaseClient): PayoutStore {
  const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T | null> => must<T>(await admin.rpc(fn, args));
  return {
    prepare: async (asOf) => ((await rpc<unknown[]>("prepare_seller_payouts", { p_as_of: asOf.toISOString() })) ?? []).map(toPayout),
    markSent: async (payoutId, transferId) => {
      await rpc("mark_seller_payout_sent", { p_payout_id: payoutId, p_transfer_id: transferId });
    },
    markFailed: async ({ payoutId, transferId }, reason) => {
      await rpc("mark_seller_payout_failed", { p_payout_id: payoutId, p_transfer_id: transferId, p_reason: reason });
    },
    updateAccount: async (update) =>
      rpc<string>("update_seller_account", {
        p_account_id: update.accountId,
        p_details_submitted: update.detailsSubmitted,
        p_charges_enabled: update.chargesEnabled,
        p_payouts_enabled: update.payoutsEnabled,
        p_requirements_due: update.requirementsDue,
        p_disabled_reason: update.disabledReason,
      }),
    recordBankPayout: async (accountId, payoutId, status, createdAt) =>
      (await rpc<number>("record_connected_payout", { p_account_id: accountId, p_provider_payout_id: payoutId, p_status: status, p_created: createdAt?.toISOString() ?? null })) ?? 0,
  };
}
