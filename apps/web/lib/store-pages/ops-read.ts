import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SALE_COLUMNS, toSale, type SaleRow } from "./store";

/**
 * What /ops/finance reads of seller payouts (plan v6 C5, decision 0156; F-G4): the liability to sellers per currency
 * from `ops_seller_liability` (which checks the actor), and the oldest sales still waiting for delivery, for ops to
 * confirm. The database and browser tests cover it.
 */

const minor = z.coerce.number().int();

const liabilityRow = z.object({ currency: z.enum(["GBP", "AUD"]), held_minor: minor, owed_minor: minor, in_flight_minor: minor, undelivered_sales: z.number().int() });

export type Liability = Readonly<{ currency: "GBP" | "AUD"; heldMinor: number; owedMinor: number; inFlightMinor: number; undeliveredSales: number }>;

export type PayoutsOpsView = Readonly<{ liability: readonly Liability[]; waiting: readonly SaleRow[] }>;

export async function loadPayoutsOps(client: SupabaseClient, admin: SupabaseClient, actor: string): Promise<PayoutsOpsView> {
  const [liability, waiting] = await Promise.all([
    admin.rpc("ops_seller_liability", { p_actor: actor }),
    client.from("seller_sales").select(SALE_COLUMNS).is("delivered_at", null).order("sold_at").limit(20),
  ]);
  if (liability.error || waiting.error) throw new Error("The seller payouts could not be read.", { cause: liability.error ?? waiting.error });
  return {
    liability: z.array(liabilityRow).parse(liability.data ?? []).map((r) => ({ currency: r.currency, heldMinor: r.held_minor, owedMinor: r.owed_minor, inFlightMinor: r.in_flight_minor, undeliveredSales: r.undelivered_sales })),
    waiting: (waiting.data ?? []).map(toSale),
  };
}
