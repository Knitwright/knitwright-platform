import type { Ladder } from "@/lib/factory/pricing";
import { runPrice } from "@/lib/payments/pricing";
import { AppError } from "@/lib/server/core/errors";
import type { NewStore } from "./store";

/**
 * WHAT A NEW STORE IS (plan v6 C2, decision 0153; spec F-T6 step 1), worked out from the design's make context and
 * what the kit manager chose. Pure: the action reads the context, runs the order checks, and hands this the result.
 *
 * The base price is the ladder's price per piece at the store's MINIMUM (the smallest order the store can become),
 * read through C1's `runPrice` from the price tier rows, never written here. A store sells at that price whatever
 * it collects, so the buyers' money always covers the order. With no price on file a store cannot open: its buyers
 * pay by card, and a card needs a price. Sizes are the design's own size run; the longest shirt name is the name
 * zone's row (`shirt_zone_limits`).
 */

export type StoreChoices = Readonly<{
  title: string;
  marginBps: number;
  minPieces: number;
  sizes: readonly string[];
  namesNumbers: boolean;
  seasonId: string | null;
  opensAt: string;
  closesAt: string;
}>;

export type StoreContext = Readonly<{
  brandId: string;
  userId: string;
  projectId: string;
  productId: string | null;
  releaseId: string | null;
  factoryProfileId: string;
  fabricKey: string;
  ladder: Ladder;
  sizeRun: readonly string[];
  /** The tightest name zone's character limit, or null when no row sets one. */
  nameMax: number | null;
  /** Why this design cannot be made as a run yet, or null. */
  whyNoRun: string | null;
}>;

export const NOT_LISTED = "List this design as a product first: a store sells a product.";
export const NO_RELEASE = "Freeze a release of this design first: a store sells a release.";
export const NO_NAME_LIMIT = "No name length is set for this design's name zone, so a store with names and numbers cannot open yet.";

/** Refuses a store that cannot open, in words the kit manager can act on. */
function refuse(context: StoreContext, choices: StoreChoices): void {
  if (context.whyNoRun !== null) throw new AppError("conflict", context.whyNoRun);
  if (context.productId === null) throw new AppError("conflict", NOT_LISTED);
  if (context.releaseId === null) throw new AppError("conflict", NO_RELEASE);
  if (choices.namesNumbers && context.nameMax === null) throw new AppError("conflict", NO_NAME_LIMIT);
  const outside = choices.sizes.filter((size) => !context.sizeRun.includes(size));
  if (outside.length > 0 || choices.sizes.length === 0) {
    throw new AppError("invalid_input", "Choose sizes from this design's size run.", { sizes: ["Choose sizes from this design's size run."] });
  }
}

export function planStore(context: StoreContext, choices: StoreChoices, code: string, flags: NewStore["flags"]): NewStore {
  refuse(context, choices);
  const price = runPrice(context.ladder, choices.minPieces, "GBP");
  if (price.status !== "priced") throw new AppError("conflict", `${price.reason} A team store needs a price, because its buyers pay by card.`);
  return {
    brandId: context.brandId,
    userId: context.userId,
    code,
    title: choices.title,
    projectId: context.projectId,
    productId: context.productId!,
    releaseId: context.releaseId!,
    factoryProfileId: context.factoryProfileId,
    fabricKey: context.fabricKey,
    flags,
    currency: "GBP",
    unitMinor: price.unitMinor,
    priceLabel: `Priced at the ${choices.minPieces}-piece tier, the store's minimum. ${price.label}`.slice(0, 300),
    marginBps: choices.marginBps,
    sizes: context.sizeRun.filter((size) => choices.sizes.includes(size)),
    namesNumbers: choices.namesNumbers,
    // With names off nothing is printed, so no zone length is needed and none is made up.
    nameMax: context.nameMax ?? 1,
    minPieces: choices.minPieces,
    seasonId: choices.seasonId,
    opensAt: choices.opensAt,
    closesAt: choices.closesAt,
  };
}
