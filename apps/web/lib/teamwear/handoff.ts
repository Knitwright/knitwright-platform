import type { SellCurrency } from "@/lib/factory/schemas";
import { kitParts, type TeamwearKit } from "./kit";
import type { KitPrice } from "./pricing";
import { GAP_RULE_ID } from "./vocabulary";

/**
 * "Order through the Knitwright Store" (plan v5 Z5, owner decision 1).
 *
 * The platform builds everything up to the order and hands it over; it never takes money. So this
 * is a hand-off and not an Add to cart: there is no basket here, no checkout, no payment and no
 * storefront. What the button produces is a reference to a saved design version with its
 * quantities and the price the configurator showed, which the Store reads through its own contract
 * (wave 5, O2). Nothing is stored by this file.
 */

/** What the button says. It is never "Add to cart", and the words say where the money is taken. */
export const HANDOFF_LABEL = "Order through the Knitwright Store";

/** Said beside the button, every time. */
export const HANDOFF_NOTE =
  "Knitwright does not take payment here. The Store takes the order, the payment and the delivery; this hands it your saved kit, its quantities and the price shown above.";

/** Said where the kit has not been saved: a hand-off needs a design version the Store can read. */
export const SAVE_FIRST = "Save the kit first. The Store is handed a saved design version, not a screen.";

/** Said where nothing in the kit has a price: a hand-off never carries a price nobody set. */
export const PRICE_FIRST = "The Store hand-off waits until something in the kit has a price.";

export interface HandoffLine {
  readonly articleCode: string;
  readonly quantity: number;
  readonly label: string;
}

/** The hand-off itself: a saved design version, its quantities, and the price the club was shown. */
export interface KitHandoff {
  readonly projectId: string;
  readonly version: number;
  readonly sportId: string;
  readonly lines: readonly HandoffLine[];
  readonly currency: SellCurrency;
  /** Integer minor units, as every money value in the platform is. */
  readonly totalMinor: number;
  /** The quantity the tier was read at, so the Store can check the price against the same tier. */
  readonly tierQty: number;
  /** The parts the hand-off leaves out, because the factory has no price for them. Never silently dropped. */
  readonly omitted: readonly string[];
  /** No rulebook entry covers the hand-off itself yet. Listed on the pull request. */
  readonly ruleId: string;
}

export type HandoffOutcome = Readonly<{ ok: true; handoff: KitHandoff }> | Readonly<{ ok: false; reason: string }>;

/** A saved design version the hand-off refers to, or null while the kit has not been saved. */
export interface SavedKit {
  readonly projectId: string;
  readonly version: number;
}

/**
 * The hand-off for a kit, or the reason there is none. Both refusals are states of the screen, not
 * errors: a kit nobody saved, and a kit nothing in which has a price.
 *
 * A part the factory has no price for is left out of the lines and named in `omitted`, rather than
 * holding up the whole kit: a club that wants a shirt and shorts should not be stopped by a sock
 * the catalogue does not cover yet.
 */
export function handoffFor(kit: TeamwearKit, saved: SavedKit | null, price: KitPrice): HandoffOutcome {
  if (saved === null) return { ok: false, reason: SAVE_FIRST };
  if (price.totalMinor === null) return { ok: false, reason: PRICE_FIRST };
  const priced = new Set(price.parts.filter((part) => part.priced).map((part) => part.partId));
  const lines = kitParts(kit).flatMap((part) =>
    part.articleCode === null || !priced.has(part.id) ? [] : [{ articleCode: part.articleCode, quantity: part.choice.quantity, label: part.label }],
  );
  return {
    ok: true,
    handoff: {
      projectId: saved.projectId,
      version: saved.version,
      sportId: kit.sportId,
      lines,
      currency: price.currency,
      totalMinor: price.totalMinor,
      tierQty: price.tierQty,
      omitted: price.parts.filter((part) => !part.priced).map((part) => part.label),
      ruleId: GAP_RULE_ID,
    },
  };
}

/**
 * The reference a club gives its Store contact, which is the design version and nothing else. The
 * Store is not built (owner decision 1), so there is no address to send a club to yet: the
 * reference is shown instead of a dead link. **Owner question** on the pull request: what address
 * should this button open once the Store exists?
 */
export const handoffReference = (handoff: KitHandoff): string => `${handoff.projectId}@v${handoff.version}`;
