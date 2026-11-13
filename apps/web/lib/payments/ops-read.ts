import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toFigures, type FinanceFigures } from "./controls";
import { SETTINGS_COLUMNS, settingsOf, type PaymentSettings } from "./settings";
import { PAYMENT_COLUMNS, toPayment, type PaymentRow } from "./store";

/**
 * What the ops finance page reads (plan v6 C1, decision 0152), with the platform admin's own client: the F-G4
 * figures from `ops_finance_figures` (which checks the actor), the settings and the newest payments. The database
 * and browser tests cover it.
 */

export type FinanceView = Readonly<{ figures: readonly FinanceFigures[]; settings: PaymentSettings; payments: readonly PaymentRow[] }>;

export async function loadFinance(client: SupabaseClient, admin: SupabaseClient, actor: string): Promise<FinanceView> {
  const [figures, settings, payments] = await Promise.all([
    admin.rpc("ops_finance_figures", { p_actor: actor }),
    client.from("payment_settings").select(SETTINGS_COLUMNS).eq("id", true).single(),
    client.from("order_payments").select(PAYMENT_COLUMNS).order("created_at", { ascending: false }).limit(50),
  ]);
  if (figures.error || settings.error || payments.error) throw new Error("The finance figures could not be read.", { cause: figures.error ?? settings.error ?? payments.error });
  return {
    figures: (figures.data as unknown[]).map(toFigures),
    settings: settingsOf(settings.data),
    payments: payments.data.map(toPayment),
  };
}
