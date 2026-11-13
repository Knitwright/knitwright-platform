import { DEFAULT_MIN_DPI } from "@/lib/artwork-intake/settings";
import type { BaseArticle } from "@/lib/catalogue";
import type { SellCurrency } from "@/lib/factory/schemas";
import { panelsFor, type GarmentSpec } from "@/lib/garment";
import type { PriceSource } from "@/lib/home/price";
import { priceStep } from "@/lib/make/prices";
import type { ProductInfo } from "./types";

/**
 * The Product info modal (plan v6 E3, decision 0147; `08` v3.5 "Editor", e41): Printify's product
 * creator gives the editor one thing, a **Product info** button at the top of the garment inspector,
 * which opens production cost, shipping, print area, file spec, print guidelines, Download template
 * and Preview on mockups.
 *
 * Nothing here is a promise the factory has not made (`10` §10). The cost is the price tier at one
 * piece with the tier's own label; the time to make is the capability's lead time; shipping has no
 * price on file, so it says it is priced at checkout rather than showing a made-up figure.
 */

export interface FactoryFacts {
  /** The factory's name as the price book has it, or null when no factory is on file. */
  readonly name: string | null;
  /** The capability's lead time in days, or null when it is not set. */
  readonly leadTimeDays: number | null;
}

export interface ProductInfoInput {
  readonly designId: string;
  readonly spec: GarmentSpec;
  readonly article: BaseArticle | null;
  readonly price: PriceSource;
  readonly currency: SellCurrency;
  readonly factory: FactoryFacts;
}

const SHIPPING_NOTE = "Freight and duty are added at checkout, by destination.";

/** The free SVG drawing of the design's front: what a person lays their artwork out against. */
export const templateHref = (designId: string): string => `/api/projects/${encodeURIComponent(designId)}/exports/svg?view=front`;

export function productInfo({ designId, spec, article, price, currency, factory }: ProductInfoInput): ProductInfo {
  const step = priceStep(price.ladder, 1, currency);
  const priced = step.result.status === "priced";
  const panels = panelsFor(spec).map((panel) => panel.label.toLowerCase());
  const maker = factory.name === null ? "Made by Knitwright" : `Made by Knitwright · ${factory.name}`;
  return {
    name: article?.name ?? spec.typeId,
    line: [article?.code ?? null, maker, article ? `Class ${article.productionClass}` : null].filter((part): part is string => part !== null).join(" · "),
    cost: {
      amount: priced ? step.text.replace(/ per piece.*$/, "") : "Not set yet",
      note: priced ? `Per piece at 1 piece${step.label ? ` · ${step.label}` : ""}` : step.text,
    },
    shipping: {
      amount: factory.leadTimeDays === null ? "Lead time not set yet" : `About ${factory.leadTimeDays} days to make`,
      note: SHIPPING_NOTE,
    },
    printArea: {
      amount: "All-over",
      note: panels.length > 0 ? panels.join(" · ") : "The print areas are set by the base article.",
    },
    file: {
      amount: `${DEFAULT_MIN_DPI} dpi or more`,
      note: "At the printed size, or a vector. Colours are checked for print safety for you.",
    },
    guidelines: [
      "Keep text and crests inside the safe zones the drawing marks.",
      `Artwork under ${DEFAULT_MIN_DPI} dpi at its printed size may print soft.`,
      "Colours may shift slightly on polyester; check them against the swatch book.",
    ],
    templateHref: templateHref(designId),
  };
}
