import { describe, expect, it } from "vitest";
import { RULE_CARE_LABEL } from "@/lib/compliance/model";
import { storeDelivery } from "./delivery";
import { storePrices } from "./money";
import { CARE_LABEL_BLOCKER, sellability } from "./sellable";
import { storeSizeChart } from "./size-chart";
import { bothLadder, deliveryComplete, deliveryToday, gbpOnlyLadder, pom } from "./fixtures/samples";

/**
 * Whether anything can be sold. The honest answer today is no, for a reason that applies to every
 * product: the production package refuses every order on its care label (decision 0089).
 */

const chart = (poms = [pom()]) => storeSizeChart({ sizes: ["S", "M", "L"], sampleSize: "M", poms });

const codesOf = (input: Parameters<typeof sellability>[0]) => sellability(input).blockers.map((blocker) => blocker.code);

describe("the sellability of a product today", () => {
  it("is no, and the care label is the reason that applies to every product", () => {
    const verdict = sellability({
      prices: storePrices(gbpOnlyLadder),
      delivery: storeDelivery(deliveryToday),
      sizeChart: chart([]),
      hasMedia: false,
    });

    expect(verdict.sellable).toBe(false);
    expect(verdict.blockers[0]).toEqual(CARE_LABEL_BLOCKER);
    expect(CARE_LABEL_BLOCKER.ruleId).toBe(RULE_CARE_LABEL);
  });

  it("names every reason, in the order a reader would act on them", () => {
    expect(
      codesOf({
        prices: storePrices(gbpOnlyLadder),
        delivery: storeDelivery(deliveryToday),
        sizeChart: chart([]),
        hasMedia: false,
      }),
    ).toEqual(["care_label_refused", "no_price_aud", "no_delivery_date", "no_size_chart", "no_media"]);
  });

  it("refuses the Australian market on its own, because no figure is published there", () => {
    expect(
      codesOf({
        prices: storePrices(gbpOnlyLadder),
        delivery: storeDelivery(deliveryComplete),
        sizeChart: chart(),
        hasMedia: true,
        currencies: ["AUD"],
      }),
    ).toEqual(["care_label_refused", "no_price_aud"]);
  });

  it("says plainly that no figure is to be worked out from another currency", () => {
    const verdict = sellability({
      prices: storePrices(gbpOnlyLadder),
      delivery: storeDelivery(deliveryComplete),
      sizeChart: chart(),
      hasMedia: true,
      currencies: ["AUD"],
    });

    expect(verdict.blockers[1]?.message).toContain("No figure is to be worked out from another currency");
  });

  it("carries a rule id on every blocker, so each one explains itself", () => {
    const verdict = sellability({
      prices: storePrices([]),
      delivery: storeDelivery(deliveryToday),
      sizeChart: chart([]),
      hasMedia: false,
    });

    expect(verdict.blockers.every((blocker) => /^R-[A-Z]+-\d{3}$/.test(blocker.ruleId))).toBe(true);
    expect(verdict.blockers.every((blocker) => blocker.message.length > 0)).toBe(true);
  });

  it("still refuses on the care label alone once everything else is on file", () => {
    expect(
      codesOf({
        prices: storePrices(bothLadder),
        delivery: storeDelivery(deliveryComplete),
        sizeChart: chart(),
        hasMedia: true,
      }),
    ).toEqual(["care_label_refused"]);
  });
});
