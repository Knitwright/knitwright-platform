import "server-only";
import { promisedDate } from "@/lib/factory/dates";
import type { Ladder } from "@/lib/factory/pricing";
import { loadProductionSettings } from "@/lib/factory/production-settings";
import type { SellCurrency } from "@/lib/factory/schemas";
import { factoryStore } from "@/lib/factory/server";
import { capabilityFor } from "@/lib/factory/service";
import { deliveryLine } from "@/lib/make/delivery";
import { adminClient } from "@/lib/server/deps";
import { configuratorHref } from "@/lib/teamwear/address";
import { partsForSport } from "@/lib/teamwear/kit";
import { sportById } from "@/lib/teamwear/vocabulary";
import type { QuoteLineRef } from "./download";
import { buildQuote, type Quote, type QuoteLineInput, type UnpricedPart } from "./quote";
import { ruleForCountry, vatTreatment } from "./vat";

/**
 * Joins a quote to the factory rows. It holds no rules of its own: the prices come from X6's own
 * tiers through `priceBasket`, the delivery line is Y7's own wording over X6's `promisedDate`, and
 * the VAT treatment is `country_rules` read through `vatTreatment`. The quote itself is built by
 * `buildQuote`, which is tested on its own.
 *
 * The market decides the country whose freight days and tax rules apply, exactly as the make pages
 * decide it (spec F-S8): GBP is the United Kingdom, AUD is Australia.
 */

const COUNTRY_OF: Readonly<Record<SellCurrency, string>> = { GBP: "GB", AUD: "AU" };

/** What a part with no base article says on the quote. Named, never priced and never dropped. */
export const NO_ARTICLE_REASON =
  "No base article covers this part yet, so the factory has no price for it. It is not in the total.";

export interface QuoteDeps {
  readonly brandName: string;
  readonly now: () => Date;
}

export interface QuoteAsk {
  readonly sportId: string;
  readonly currency: SellCurrency;
  readonly clubName: string | null;
  readonly lines: readonly QuoteLineRef[];
  /** Parts of the kit the catalogue does not cover, each with the label the club sees. */
  readonly unpricedLabels: readonly string[];
  readonly inclusions: Readonly<{ crest: boolean; sponsors: number; namesNumbers: boolean }>;
}

/** The ladder of one article at this factory, or an empty one when the factory does not make it. */
const ladderFor = (snapshot: Awaited<ReturnType<ReturnType<typeof factoryStore>["snapshot"]>> | null, articleCode: string): Ladder =>
  snapshot === null ? [] : snapshot.tiers.filter((tier) => tier.capabilityId === capabilityFor(snapshot, articleCode)?.id);

/**
 * One quote, priced and dated from the rows on file. Every part of the sum that is not set makes
 * the quote say so: no delivery date is invented and no tax is added.
 */
export async function buildQuoteFor(deps: QuoteDeps, ask: QuoteAsk): Promise<Quote> {
  const store = factoryStore();
  const [factories, rules, settings] = await Promise.all([store.listFactories(), store.listCountryRules(), loadProductionSettings(adminClient())]);
  const factory = [...factories].sort((a, b) => a.slug.localeCompare(b.slug))[0] ?? null;
  const snapshot = factory === null ? null : await store.snapshot(factory);
  const rule = ruleForCountry(rules, COUNTRY_OF[ask.currency]);
  // The part's own label, so a club reads "Shirt" and the factory reads the code beside it.
  const labels = new Map(
    partsForSport(sportById(ask.sportId)).flatMap((part) => (part.articleCode === null ? [] : [[part.articleCode, part.label] as const])),
  );
  const lines: readonly QuoteLineInput[] = ask.lines.map((line) => ({
    articleCode: line.articleCode,
    label: labels.get(line.articleCode) ?? line.articleCode,
    qty: line.qty,
    ladder: ladderFor(snapshot, line.articleCode),
  }));
  const capability = snapshot === null ? undefined : capabilityFor(snapshot, ask.lines[0]?.articleCode ?? "");
  const promised = promisedDate({
    orderAt: deps.now(),
    // Every launch article is Class A (decision 0066), and a Class A order starts at the next cut-off.
    productionClass: "A",
    timeZone: factory?.timeZone ?? "UTC",
    cutoff: settings.cutoff,
    leadTimeDays: capability?.leadTimeDays ?? null,
    qcDays: settings.qcDays,
    freightDays: rule?.freightDays ?? null,
  });
  const unpriced: readonly UnpricedPart[] = ask.unpricedLabels.map((label) => ({ label, reason: NO_ARTICLE_REASON }));
  return buildQuote({
    issuedAt: deps.now(),
    clubName: ask.clubName ?? deps.brandName,
    brandName: deps.brandName,
    sportId: ask.sportId,
    sportLabel: sportById(ask.sportId).label,
    currency: ask.currency,
    lines,
    unpriced,
    inclusions: ask.inclusions,
    delivery: deliveryLine({ date: promised, placeholder: settings.isPlaceholder }),
    vat: vatTreatment(rule),
    // Back to the kit in the configurator. There is no address to pay at: the Knitwright Store
    // takes the order and the money, and it is not built yet (owner decision 1).
    linkBack: configuratorHref({ sportId: ask.sportId, part: "shirt", market: ask.currency }),
    factoryLabel: factory === null ? null : `${factory.name} · ${factory.city} · ${factory.label}`,
  });
}
