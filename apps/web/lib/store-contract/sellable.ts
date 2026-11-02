import { RULE_CARE_LABEL } from "@/lib/compliance/model";
import { SELL_CURRENCIES, type SellCurrency } from "@/lib/factory/schemas";
import { hasNoDate, type StoreDelivery } from "./delivery";
import { GAP_RULE_ID, isGap } from "./gap";
import { pricedIn, type StorePrices } from "./money";
import type { StoreSizeChart } from "./size-chart";

/**
 * Whether a product can be sold at all (plan v5 O2).
 *
 * A published product is a record, not a guess. The platform holds plenty of products whose article
 * has gaps, and the honest thing to hand another product is not a tidy listing with holes hidden in
 * it: it is the listing, plus the reasons it cannot be sold yet, each carrying the rule that
 * explains it. Nothing is left out of the payload because of a gap, and nothing is presented as
 * complete because the gap was quiet.
 *
 * Today every product carries at least one reason, and one of them applies to all of them: the
 * production package refuses every order on its care label (decision 0089). ISO 3758 is not in this
 * repository, so no care symbol and no care wording exists, so no label may be printed, so no order
 * may be made. Nothing in this platform is sellable until that is settled, and this field says so
 * rather than leaving a Store to find out at the hand-off.
 */

export interface SaleBlocker {
  readonly code: string;
  readonly message: string;
  readonly ruleId: string;
}

export interface Sellability {
  /** False while any blocker holds. The one field a Store reads before it offers anything. */
  readonly sellable: boolean;
  readonly blockers: readonly SaleBlocker[];
}

export const CARE_LABEL_BLOCKER: SaleBlocker = {
  code: "care_label_refused",
  message:
    "No care symbol and no care wording is on file, so no label can be printed for any market and the production package refuses every order. Nothing can be sold until a licensed source for the care symbols is on file.",
  ruleId: RULE_CARE_LABEL,
};

export interface SellabilityInput {
  readonly prices: StorePrices;
  readonly delivery: StoreDelivery;
  readonly sizeChart: StoreSizeChart;
  /** False where no launch pack has been handed over, so the Store has no picture. */
  readonly hasMedia: boolean;
  /** The market the Store is asking about, so a missing figure is named per currency. */
  readonly currencies?: readonly SellCurrency[];
}

const priceBlocker = (currency: SellCurrency): SaleBlocker => ({
  code: `no_price_${currency.toLowerCase()}`,
  message: `Not every quantity band carries a ${currency} figure, so the Store cannot price this product in that market. No figure is to be worked out from another currency.`,
  ruleId: GAP_RULE_ID,
});

/**
 * Every reason this product cannot be sold, in the order a reader would act on them. Each reason is
 * read off the payload's own fields, so the verdict can never disagree with what the payload shows:
 * a blocker over a date is raised from the same gap the `delivery` field carries.
 */
export function sellability(input: SellabilityInput): Sellability {
  const currencies = input.currencies ?? SELL_CURRENCIES;
  const promised = input.delivery.promised;
  const blockers = [
    CARE_LABEL_BLOCKER,
    ...currencies.filter((currency) => !pricedIn(input.prices, currency)).map(priceBlocker),
    hasNoDate(input.delivery) && isGap(promised)
      ? { code: "no_delivery_date", message: promised.because, ruleId: promised.ruleId }
      : null,
    isGap(input.sizeChart)
      ? { code: "no_size_chart", message: input.sizeChart.because, ruleId: input.sizeChart.ruleId }
      : null,
    input.hasMedia
      ? null
      : {
          code: "no_media",
          message:
            "No launch pack has been handed over for this product, so Knitwright holds no picture of it and the Store has nothing to show.",
          ruleId: GAP_RULE_ID,
        },
  ].filter((blocker): blocker is SaleBlocker => blocker !== null);
  return { sellable: blockers.length === 0, blockers };
}
