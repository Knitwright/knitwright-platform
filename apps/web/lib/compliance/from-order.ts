import type { DestinationLabel } from "./labels";
import type { ModerationState, ProductionClass } from "./model";
import type { PreExportSubject } from "./subject";

/**
 * Ordering, as the one checklist reads it (plan v5 Y7, F-S7). An order is not a fourth document: it is the
 * same garment the Review tab shows and the package is built from, going to a factory. So this takes the
 * subject already built from the document and overlays what the order itself knows — which markets the pieces
 * are going to, the production class of the run, and whether a person has looked at the design.
 *
 * Building it this way is what stops the three places disagreeing. A design that the Review tab calls clear
 * cannot fail at hand-off for a reason Review never showed, because hand-off runs the same items over the
 * same values; the only new refusals are the ones an order is the first to know about.
 */

export interface OrderFacts {
  /** The labels for the markets this order's pieces are going to. */
  readonly labels: readonly DestinationLabel[];
  /** The base article's production class (decision 0066). Null: no base article covers the design. */
  readonly productionClass: ProductionClass;
  /**
   * Whether a person has allowed this design version (X8 `humanAllowed`). Null: nobody has been asked. A
   * Class B run is refused until this is true, which is the F-G1 human-review gate and not the 50 to 300
   * piece range: that range is a flag on the quantity and `lib/make/run.ts` owns it.
   */
  readonly humanAllowed: boolean | null;
  /** The design's moderation result, screened again before the order (X8 `screenBeforeOrder`). */
  readonly moderation: ModerationState;
}

export function subjectForOrder(document: PreExportSubject, order: OrderFacts): PreExportSubject {
  return {
    ...document,
    source: "order",
    labels: order.labels,
    moderation: { state: order.moderation, productionClass: order.productionClass, humanAllowed: order.humanAllowed },
  };
}
