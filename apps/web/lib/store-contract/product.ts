import type { ArticlePom } from "@/lib/catalogue";
import type { Ladder } from "@/lib/factory/pricing";
import type { ProductionClass } from "@/lib/factory/schemas";
import type { ListingMedia } from "@/lib/flows/listing";
import { storeDelivery, type DeliveryInput, type StoreDelivery } from "./delivery";
import { gap, held, type Known } from "./gap";
import { storePrices, type StorePrices } from "./money";
import type { StorePersonalisation } from "./personalisation";
import { sellability, type Sellability } from "./sellable";
import { storeSizeChart, type StoreSizeChart } from "./size-chart";

/**
 * One published product, as the Store reads it (plan v5 O2).
 *
 * "Published" is a record here, never a guess. A product appears in this payload only because the
 * platform holds a hand-off naming it: a collection drop exported from a plan (decision 0085) or a
 * launch listing from "Publish to store" (decision 0096). Both already exist, both are append-only,
 * and both are the brand saying "this one". A product nobody handed over is not in the payload at
 * all, and the `publishedBy` list is never empty.
 *
 * Everything else about it is read from rows and carried with its gaps showing: the price ladder
 * from `price_tiers`, the size run and the measurements from the base article, the dates from the
 * factory's own figures, the personalisation limits from their own rows. Where the platform holds
 * nothing, the field is a `Gap` and `sellability` says what that stops.
 */

export const PRODUCT_STAGES = ["idea", "sample", "run"] as const;
export type ProductStage = (typeof PRODUCT_STAGES)[number];

/** How a product came to be in this payload. */
export type Publication =
  | Readonly<{ via: "collection-drop"; collectionId: string; dropId: string; dropVersion: number; at: string }>
  | Readonly<{ via: "flow-listing"; listingId: string; launchProjectId: string; at: string }>;

/** One size of the run, and the target a plan set for it. A target is a plan, not an amount held. */
export interface StoreSize {
  readonly size: string;
  /** True where the base article grades to this size. False: a plan asked for a size the article has no grade for. */
  readonly inSizeRun: boolean;
  readonly planned: Known<{ targetQty: number }>;
}

/** One picture or clip, exactly as L6's listing hand-off describes it. */
export interface StoreMediaItem extends ListingMedia {
  readonly listingId: string;
}

/** What the catalogue holds about the article behind the product. */
export interface ArticleFacts {
  readonly code: string;
  readonly name: string;
  readonly productionClass: ProductionClass;
  readonly sizes: readonly string[];
  readonly sampleSize: string | null;
  readonly poms: readonly ArticlePom[];
}

export interface ProductInput {
  readonly productId: string;
  readonly brandId: string;
  readonly designProjectId: string;
  readonly designVersion: number;
  readonly name: string;
  readonly stage: ProductStage;
  readonly publications: readonly Publication[];
  /** Null where no hand-off and no run names an article: the product is a design, not yet an article. */
  readonly article: ArticleFacts | null;
  readonly ladder: Ladder;
  /** The targets a collection plan set, by size. Empty where the product was handed over by a listing only. */
  readonly planned: readonly Readonly<{ size: string; targetQty: number }>[];
  readonly media: readonly StoreMediaItem[];
  readonly delivery: DeliveryInput;
  readonly personalisation: StorePersonalisation;
}

export interface StoreProduct {
  readonly productId: string;
  readonly brandId: string;
  readonly designProjectId: string;
  readonly designVersion: number;
  readonly name: string;
  readonly stage: ProductStage;
  /** Why this product is here. Never empty: nothing reaches the payload without one. */
  readonly publishedBy: readonly Publication[];
  readonly article: Known<{ code: string; name: string; productionClass: ProductionClass }>;
  readonly sizes: Known<{ run: readonly StoreSize[] }>;
  readonly prices: StorePrices;
  readonly delivery: StoreDelivery;
  readonly sizeChart: StoreSizeChart;
  readonly personalisation: StorePersonalisation;
  readonly media: Known<{ items: readonly StoreMediaItem[] }>;
  readonly sellability: Sellability;
}

const NO_ARTICLE = "the base article this product is made from";
const NO_MEDIA = "any picture of this product";

const sizesOf = (input: ProductInput): Known<{ run: readonly StoreSize[] }> => {
  const run = input.article?.sizes ?? [];
  const planned = new Map(input.planned.map((one) => [one.size, one.targetQty]));
  const labels = [...run, ...[...planned.keys()].filter((size) => !run.includes(size))];
  if (labels.length === 0) {
    return gap(["the size run for this product"], `Knitwright holds no figure for ${NO_ARTICLE}, so there is no size run and the Store has nothing to offer.`);
  }
  return held({
    run: labels.map((size) => ({
      size,
      inSizeRun: run.includes(size),
      planned: planned.has(size)
        ? held({ targetQty: planned.get(size) as number })
        : gap(["a planned quantity for this size"], "No collection plan set a target for this size, so Knitwright holds no figure for it. A target is a plan, not an amount the Store may offer."),
    })),
  });
};

const mediaOf = (input: ProductInput): Known<{ items: readonly StoreMediaItem[] }> =>
  input.media.length === 0
    ? gap(
        [NO_MEDIA],
        `Knitwright holds no figure for ${NO_MEDIA}: no launch pack has been handed over for it, so the Store has nothing to show and must not use a picture of another product.`,
      )
    : held({ items: [...input.media].sort((a, b) => a.sort - b.sort) });

/** One product's whole entry. Pure: every row it reads has already been read. */
export function storeProduct(input: ProductInput): StoreProduct {
  if (input.publications.length === 0) throw new RangeError("A product reaches the Store because a hand-off names it; this one has none.");
  const article = input.article;
  const prices = storePrices(input.ladder);
  const delivery = storeDelivery(input.delivery);
  const sizeChart =
    article === null
      ? gap([NO_ARTICLE], `Knitwright holds no figure for ${NO_ARTICLE}, so there is no size chart and no measurement to show.`)
      : storeSizeChart({ sizes: article.sizes, sampleSize: article.sampleSize, poms: article.poms });
  const media = mediaOf(input);
  return {
    productId: input.productId,
    brandId: input.brandId,
    designProjectId: input.designProjectId,
    designVersion: input.designVersion,
    name: input.name,
    stage: input.stage,
    publishedBy: [...input.publications],
    article:
      article === null
        ? gap([NO_ARTICLE], `Knitwright holds no figure for ${NO_ARTICLE}, so nothing about how it is made can be stated.`)
        : held({ code: article.code, name: article.name, productionClass: article.productionClass }),
    sizes: sizesOf(input),
    prices,
    delivery,
    sizeChart,
    personalisation: input.personalisation,
    media,
    sellability: sellability({ prices, delivery, sizeChart, hasMedia: media.status === "held" }),
  };
}
