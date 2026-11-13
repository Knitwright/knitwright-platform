import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getBaseArticle } from "@/lib/catalogue";
import { emptySource, ratesFor } from "@/lib/collections/pricing";
import { listFreightRates } from "@/lib/collections/service";
import type { LandedRates } from "@/lib/collections/types";
import type { Ladder } from "@/lib/factory/pricing";
import type { SellCurrency } from "@/lib/factory/schemas";
import { factoryStore } from "@/lib/factory/server";
import { ladderForArticle } from "@/lib/order-desk/server";
import type { ChannelFee, SellerChannel } from "./margin";
import { BRANDING_OPTION_COLUMNS, STORE_SETTINGS_COLUMNS, toBrandingOption, toStoreSettings, type BrandingOption, type StoreSettings } from "./settings";
import { ACCOUNT_COLUMNS, PAYOUT_COLUMNS, SALE_COLUMNS, toAccount, toPayout, toSale, type AccountRow, type PayoutRow, type SaleRow } from "./store";

/**
 * What the seller's Store pages read (plan v6 C5, decision 0156), with the member's own client so row security
 * decides what they see; the factory model with the server's key, as decision 0071 asks. No rules here: they are in
 * `dashboard.ts` and `margin.ts`. The database and browser tests cover it.
 */

const unreadable = (cause: unknown): Error => new Error("The store could not be read.", { cause });

export type PayoutsData = Readonly<{
  sales: readonly SaleRow[];
  payouts: readonly PayoutRow[];
  account: AccountRow | null;
  /** Per sale: what payouts that have not failed paid on it. */
  paidBySale: ReadonlyMap<string, number>;
}>;

const paidLine = z.object({ sale_id: z.uuid(), amount_minor: z.coerce.number().int(), seller_payouts: z.object({ status: z.string() }) });

export async function loadPayoutsData(client: SupabaseClient, brandId: string): Promise<PayoutsData> {
  const [sales, payouts, account, lines] = await Promise.all([
    client.from("seller_sales").select(SALE_COLUMNS).eq("brand_id", brandId).order("sold_at", { ascending: false }).limit(500),
    client.from("seller_payouts").select(PAYOUT_COLUMNS).eq("brand_id", brandId).order("created_at", { ascending: false }).limit(52),
    client.from("seller_accounts").select(ACCOUNT_COLUMNS).eq("brand_id", brandId).maybeSingle(),
    client.from("seller_payout_lines").select("sale_id, amount_minor, seller_payouts!inner(status)").eq("brand_id", brandId).neq("seller_payouts.status", "failed"),
  ]);
  const failed = sales.error ?? payouts.error ?? account.error ?? lines.error;
  if (failed) throw unreadable(failed);
  const paidBySale = new Map<string, number>();
  for (const line of z.array(paidLine).parse(lines.data ?? [])) paidBySale.set(line.sale_id, (paidBySale.get(line.sale_id) ?? 0) + line.amount_minor);
  return {
    sales: (sales.data ?? []).map(toSale),
    payouts: (payouts.data ?? []).map(toPayout),
    account: account.data ? toAccount(account.data) : null,
    paidBySale,
  };
}

export type SettingsData = Readonly<{ settings: StoreSettings; options: readonly BrandingOption[] }>;

export async function loadStoreSettings(client: SupabaseClient, brandId: string): Promise<SettingsData> {
  const [settings, options] = await Promise.all([
    client.from("store_settings").select(STORE_SETTINGS_COLUMNS).eq("brand_id", brandId).maybeSingle(),
    client.from("store_branding_options").select(BRANDING_OPTION_COLUMNS).order("sort"),
  ]);
  if (settings.error || options.error) throw unreadable(settings.error ?? options.error);
  return { settings: toStoreSettings(settings.data), options: (options.data ?? []).map(toBrandingOption) };
}

/** One article the factory prices, for the margin calculator. */
export type CalculatorArticle = Readonly<{ code: string; name: string; ladder: Ladder }>;

/** One market a seller may sell into, with the landed rates of each article there. */
export type CalculatorMarket = Readonly<{ country: string; name: string; currency: SellCurrency; rates: Readonly<Record<string, LandedRates>> }>;

export type CalculatorData = Readonly<{
  articles: readonly CalculatorArticle[];
  markets: readonly CalculatorMarket[];
  fees: readonly ChannelFee[];
  knitwrightFeeBps: number;
  feeLabel: string;
}>;

const feeRow = z.object({
  channel: z.enum(["storefront", "team_store", "shopify", "api"]),
  currency: z.enum(["GBP", "AUD"]),
  percent_bps: z.number().int(),
  fixed_minor: z.coerce.number().int(),
  label: z.string(),
  is_placeholder: z.boolean(),
});

const toFee = (row: unknown): ChannelFee => {
  const r = feeRow.parse(row);
  return { channel: r.channel as SellerChannel, currency: r.currency, percentBps: r.percent_bps, fixedMinor: r.fixed_minor, label: r.label, isPlaceholder: r.is_placeholder };
};

/** Everything the margin calculator needs: the factory's ladders, the selling markets' rates, the fee rows. */
export async function loadCalculator(client: SupabaseClient): Promise<CalculatorData> {
  const store = factoryStore();
  const [factories, rules, freight, fees, settings] = await Promise.all([
    store.listFactories(),
    store.listCountryRules(),
    listFreightRates(client),
    client.from("seller_channel_fees").select("channel, currency, percent_bps, fixed_minor, label, is_placeholder"),
    client.from("seller_payout_settings").select("knitwright_fee_bps, label").eq("id", true).maybeSingle(),
  ]);
  if (fees.error || settings.error) throw unreadable(fees.error ?? settings.error);
  const factory = [...factories].sort((a, b) => a.slug.localeCompare(b.slug))[0] ?? null;
  const snapshot = factory ? await store.snapshot(factory) : null;
  const codes = [...new Set((snapshot?.capabilities ?? []).map((capability) => capability.articleCode))].sort();
  const found = await Promise.all(codes.map((code) => getBaseArticle(client, code)));
  const articles = codes
    .map((code, index) => ({ code, name: found[index]?.name ?? code, ladder: ladderForArticle(snapshot, code), hsCode: found[index]?.hsCode ?? null }))
    .filter((article) => article.ladder.length > 0);
  const hsByArticle = Object.fromEntries(articles.map((article) => [article.code, article.hsCode]));
  const markets = rules
    .filter((rule) => rule.sellingEnabled && (rule.currency === "GBP" || rule.currency === "AUD"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((rule) => {
      const source = { ...emptySource(rule.country), freight: freight.find((one) => one.country === rule.country) ?? null, dutyByHs: rule.dutyByHs, countryLabel: rule.label, countryRuleId: rule.ruleId, hsByArticle };
      return { country: rule.country, name: rule.name, currency: rule.currency as SellCurrency, rates: Object.fromEntries(articles.map((article) => [article.code, ratesFor(source, article.code)])) };
    });
  const row = settings.data as { knitwright_fee_bps?: number; label?: string } | null;
  return {
    articles: articles.map(({ code, name, ladder }) => ({ code, name, ladder })),
    markets,
    fees: (fees.data ?? []).map(toFee),
    knitwrightFeeBps: row?.knitwright_fee_bps ?? 0,
    feeLabel: row?.label ?? "",
  };
}
