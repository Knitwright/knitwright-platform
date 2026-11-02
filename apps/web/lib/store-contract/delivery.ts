import { describeMissing, promisedDate, type CutoffSetting } from "@/lib/factory/dates";
import type { ProductionClass } from "@/lib/factory/schemas";
import { gap, held, type Known } from "./gap";

/**
 * Delivery in the contract (plan v5 O2; X6's dates, decision 0071).
 *
 * **No delivery date can be shown anywhere today.** The days for QC and the freight days are both
 * unset — no factory has agreed a QC window and no destination row carries freight days — so
 * `promisedDate` answers "not set" for every article, in every market. Every screen in the platform
 * already names what is missing instead of a date (`lib/factory/dates.ts`), and this payload has to
 * do the same for a reader we do not control.
 *
 * Two fields, deliberately apart:
 *
 *   * `productionStartsAt` is a fact the platform does hold: the next weekly cut-off, read on the
 *     factory's own clock. It is not a delivery date and must never be shown as one.
 *   * `promised` is the delivery date, and today it is always a `Gap`. It carries no date field at
 *     all, so a Store cannot read a null as "today" — which is the whole reason this shape exists.
 */

export interface DeliveryInput {
  readonly orderAt: Date;
  readonly productionClass: ProductionClass;
  readonly timeZone: string;
  readonly cutoff: CutoffSetting;
  /** From the factory's capability row. Null: that factory has agreed no lead time for the article. */
  readonly leadTimeDays: number | null;
  /** From the production settings. Null everywhere today: nobody has agreed a QC window. */
  readonly qcDays: number | null;
  /** From the destination's country rule. Null everywhere today: no freight figure is on file. */
  readonly freightDays: number | null;
}

/** The three dates a delivery promise is made of, or the gap that stands in for all three. */
export type PromisedDates = Known<{ readyForQcOn: string; shipsOn: string; promisedOn: string }>;

export interface StoreDelivery {
  /**
   * When production starts counting for an order placed now: the Class A cut-off, or the moment of
   * a Class B order. An ISO instant, and never a delivery date.
   */
  readonly productionStartsAt: string;
  readonly promised: PromisedDates;
}

const CONSEQUENCE = "No delivery date exists, so the Store names what is missing instead of showing one.";

export function storeDelivery(input: DeliveryInput): StoreDelivery {
  const answer = promisedDate(input);
  if (answer.status === "not-set") {
    return {
      productionStartsAt: answer.startsAt.toISOString(),
      promised: gap(answer.missing, `${describeMissing(answer.missing)} ${CONSEQUENCE}`),
    };
  }
  return {
    productionStartsAt: answer.startsAt.toISOString(),
    promised: held({ readyForQcOn: answer.readyForQcOn, shipsOn: answer.shipsOn, promisedOn: answer.promisedOn }),
  };
}

/** True while the platform can promise nothing. Read by the sellability verdict, so the two agree. */
export const hasNoDate = (delivery: StoreDelivery): boolean => delivery.promised.status === "gap";
