import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { refusal } from "@/lib/make/service";
import { PURCHASE_SELECT, STORE_COLUMNS, toPurchase, toStore } from "./model";
import type { TeamStoreStore } from "./store";

/**
 * The team store tables through the server's key (migration 20261228020000). A refusal the database writes for a
 * person comes back as an AppError in its words. The database tests cover this file
 * (`tests/integration/team-stores.test.ts`).
 */

type Answer<T> = Readonly<{ data: T | null; error: Readonly<{ code?: string; hint?: string | null; message: string }> | null }>;

const must = <T>(answer: Answer<T>, missing = "That store does not exist."): T | null => {
  if (answer.error) throw refusal(answer.error, missing);
  return answer.data;
};

const opened = z.object({
  payment_id: z.uuid(),
  store_id: z.uuid(),
  brand_id: z.uuid(),
  amount_minor: z.coerce.number().int(),
  currency: z.enum(["GBP", "AUD"]),
  description: z.string(),
  created: z.boolean(),
});

/** How long after a close the run keeps looking for a payment that arrived late. Stripe's checkout lasts a day. */
const LATE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function supabaseTeamStores(admin: SupabaseClient): TeamStoreStore {
  const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T | null> => must<T>(await admin.rpc(fn, args));
  const oneBy = async (column: string, value: string) => {
    const row = must(await admin.from("team_stores").select(STORE_COLUMNS).eq(column, value).maybeSingle());
    return row === null ? null : toStore(row);
  };

  return {
    openStore: async (input) =>
      (await rpc<string>("open_team_store", {
        p_brand_id: input.brandId,
        p_user_id: input.userId,
        p_code: input.code,
        p_title: input.title,
        p_project_id: input.projectId,
        p_product_id: input.productId,
        p_release_id: input.releaseId,
        p_factory_profile_id: input.factoryProfileId,
        p_fabric_key: input.fabricKey,
        p_flags: input.flags,
        p_currency: input.currency,
        p_unit_minor: input.unitMinor,
        p_price_label: input.priceLabel,
        p_margin_bps: input.marginBps,
        p_sizes: input.sizes,
        p_names_numbers: input.namesNumbers,
        p_name_max: input.nameMax,
        p_min_pieces: input.minPieces,
        p_season_id: input.seasonId,
        p_opens_at: input.opensAt,
        p_closes_at: input.closesAt,
      }))!,
    endStore: async (who, storeId, how) => {
      await rpc("end_team_store", { p_brand_id: who.brandId, p_user_id: who.userId, p_store_id: storeId, p_how: how });
    },
    storeById: (id) => oneBy("id", id),
    storeByCode: (code) => oneBy("code", code),
    openPurchase: async (input) => {
      const rows = (await rpc<unknown[]>("open_team_store_payment", {
        p_code: input.code,
        p_request_key: input.requestKey,
        p_buyer_name: input.buyerName,
        p_buyer_email: input.buyerEmail,
        p_lines: input.lines.map((line) => ({ size_label: line.sizeLabel, print_name: line.printName, print_number: line.printNumber })),
      })) ?? [];
      const r = opened.parse(rows[0]);
      return { paymentId: r.payment_id, storeId: r.store_id, brandId: r.brand_id, amountMinor: r.amount_minor, currency: r.currency, description: r.description, created: r.created };
    },
    purchases: async (storeId) => (must(await admin.from("team_store_orders").select(PURCHASE_SELECT).eq("store_id", storeId).order("created_at")) ?? []).map(toPurchase),
    beginClose: async (storeId) => toStore(((await rpc<unknown[]>("begin_team_store_close", { p_store_id: storeId })) ?? [])[0]),
    finishClose: async (storeId, status, orderId, runId, message) => {
      await rpc("finish_team_store_close", { p_store_id: storeId, p_status: status, p_order_id: orderId, p_run_id: runId, p_message: message });
    },
    storesToSweep: async (now) => {
      const since = new Date(now.getTime() - LATE_WINDOW_MS).toISOString();
      const rows = must(
        await admin
          .from("team_stores")
          .select("id")
          .or(`and(status.eq.open,closes_at.lte.${now.toISOString()}),status.in.(closing,refunding),and(status.in.(closed,refunded),closed_at.gte.${since})`)
          .limit(200),
      ) as { id: string }[] | null;
      return (rows ?? []).map((row) => row.id);
    },
    purgeBuyers: async (now) => (await rpc<number>("purge_team_store_buyers", { p_now: now.toISOString() })) ?? 0,
  };
}
