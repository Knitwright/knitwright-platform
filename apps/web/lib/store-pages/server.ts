import "server-only";
import { getEnv } from "@/lib/config/env";
import { AppError } from "@/lib/server/core/errors";
import { adminClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import { connectFrom, type Connect } from "./connect";
import type { ConnectEvent } from "./connect-events";
import { supabasePayouts } from "./db";
import { PAYOUTS_PATH } from "./routes";
import { actOnConnect, runPayouts, type RunResult } from "./payout-run";

/**
 * Seller payouts wired to the database, the Connect processor chosen by the environment and the log (plan v6 C5,
 * decision 0156). No rules live here; the database and browser tests cover the joins.
 */

export const connect = (): Connect | null => connectFrom(getEnv());

export const payoutStore = () => supabasePayouts(adminClient());

/** The weekly run: the cron's and the ops page's. */
export const runWeeklyPayouts = (): Promise<RunResult> => runPayouts({ store: payoutStore(), connect: connect()?.provider ?? null, now: () => new Date(), log });

/** What C1's webhook does with a Connect event. */
export const onConnectEvent = (event: ConnectEvent): Promise<string> => actOnConnect(payoutStore(), event);

const siteUrl = (path: string): string => new URL(path, getEnv().NEXT_PUBLIC_SITE_URL).toString();

/**
 * Sends an owner or admin to Stripe's onboarding for the brand's Express account, making the account first when
 * the brand has none. A second press reuses the account: the database keeps the first one.
 */
export async function onboardingUrl(input: Readonly<{ brandId: string; userId: string; email?: string }>): Promise<string> {
  const chosen = connect();
  if (chosen === null) throw new AppError("conflict", "Payouts are not switched on yet.");
  const admin = adminClient();
  const [{ data: existing }, { data: brand }] = await Promise.all([
    admin.from("seller_accounts").select("provider_account_id").eq("brand_id", input.brandId).maybeSingle(),
    admin.from("brands").select("country").eq("id", input.brandId).maybeSingle(),
  ]);
  let accountId = (existing as { provider_account_id?: string } | null)?.provider_account_id ?? null;
  if (accountId === null) {
    const country = (brand as { country?: string | null } | null)?.country ?? "GB";
    const made = await chosen.provider.createAccount({ brandId: input.brandId, country, email: input.email });
    const { data, error } = await admin.rpc("open_seller_account", {
      p_actor: input.userId,
      p_brand_id: input.brandId,
      p_provider: chosen.provider.name,
      p_account_id: made.accountId,
      p_country: country,
    });
    if (error) throw new AppError(error.code === "42501" ? "forbidden" : "internal", error.code === "42501" ? error.message : "Payouts could not be set up.");
    accountId = data as string;
  }
  return chosen.provider.onboardingLink({ accountId, refreshUrl: siteUrl(`${PAYOUTS_PATH}?onboarding=again`), returnUrl: siteUrl(`${PAYOUTS_PATH}?onboarding=back`) });
}

/** The seller's own Stripe Express dashboard, for an account that exists. */
export async function dashboardUrl(brandId: string): Promise<string> {
  const chosen = connect();
  const { data } = await adminClient().from("seller_accounts").select("provider_account_id").eq("brand_id", brandId).maybeSingle();
  const accountId = (data as { provider_account_id?: string } | null)?.provider_account_id;
  if (chosen === null || !accountId) throw new AppError("not_found", "This brand has no payout account.");
  return chosen.provider.dashboardLink(accountId);
}
