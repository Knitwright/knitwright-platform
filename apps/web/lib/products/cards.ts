import type { Route } from "next";
import type { BaseArticleSummary } from "@/lib/catalogue/types";
import type { FabricColour, ProgrammeFabric, SellCurrency } from "@/lib/factory/schemas";
import { STATUS_LABELS } from "@/lib/home/catalogue-view";
import { fromPrice, type FromPrice, type PriceSource } from "@/lib/home/price";
import { productHref } from "./routes";

/**
 * A product card (10 §8 "Product card"; 08 v3.5): the render, the name, the code, "From £22 · from 1 pc", the
 * Studio Pro price, the class tag, a badge, and sizes · colours.
 *
 * Every figure is read from a row. The price is X6's tier (decision 0071); the Studio Pro price would be that tier
 * less the plan's discount, and no plan discount is stored anywhere yet (01: "up to 15% off base prices", to be
 * confirmed), so it reads "not set yet" rather than a made-up 20%. The prototype's Bestseller and New badges need a
 * sales count and a launch date that no row keeps; the one badge the rows can back is Eco, from the fabric
 * programme's PFAS-free and OEKO-TEX columns.
 */

export const NOT_SET_YET = "Not set yet";
export const PRO_NOT_SET = "Studio Pro price not set yet";

export type Badge = Readonly<{ label: string; tone: "ok" | "info" | "beta" }>;

export interface ProductCardView {
  readonly code: string;
  readonly name: string;
  readonly href: Route;
  /** "By Knitwright · Sialkot", or "By Knitwright" with no factory on file. */
  readonly maker: string;
  readonly price: FromPrice;
  readonly proPrice: string;
  readonly classTag: string;
  readonly status: string;
  readonly badge: Badge | null;
  /** "XS–3XL · 14 colours", with "not set" for whichever half no row holds. */
  readonly spread: string;
  readonly registryTypeId: string | null;
}

/** What every card on a page reads from: the factory's price book, its fabrics and colours, and its city. */
export interface CardContext {
  readonly source: (code: string) => PriceSource;
  readonly fabrics: readonly ProgrammeFabric[];
  readonly colours: readonly FabricColour[];
  readonly factoryCity: string | null;
  readonly currency: SellCurrency;
}

/** True where a fabric of the article is PFAS-free or carries an OEKO-TEX certificate, on the programme's row. */
export function isEco(fabricCodes: readonly string[], fabrics: readonly ProgrammeFabric[]): boolean {
  return fabrics.some((fabric) => fabricCodes.includes(fabric.code) && (fabric.pfasFree === true || fabric.oekoTexCert !== null));
}

/** "XS–3XL", or null when the article has no size range yet. */
export const sizeSpan = (sizes: readonly string[]): string | null =>
  sizes.length === 0 ? null : sizes.length === 1 ? sizes[0]! : `${sizes[0]}–${sizes.at(-1)}`;

/** How many stock colours the article's fabrics come in, or null when the programme lists none. */
export function colourCount(fabricCodes: readonly string[], colours: readonly FabricColour[]): number | null {
  const count = colours.filter((colour) => fabricCodes.includes(colour.fabricCode)).length;
  return count === 0 ? null : count;
}

function spreadOf(article: BaseArticleSummary, colours: readonly FabricColour[]): string {
  const sizes = sizeSpan(article.sizeRange) ?? "Sizes not set yet";
  const count = colourCount(article.fabricCodes, colours);
  const colourText = count === null ? "colours not set yet" : `${count} colour${count === 1 ? "" : "s"}`;
  return `${sizes} · ${colourText}`;
}

export function productCard(article: BaseArticleSummary, context: CardContext): ProductCardView {
  return {
    code: article.code,
    name: article.name,
    href: productHref(article.code),
    maker: context.factoryCity === null ? "By Knitwright" : `By Knitwright · ${context.factoryCity}`,
    price: fromPrice(context.source(article.code), context.currency),
    proPrice: PRO_NOT_SET,
    classTag: `Class ${article.productionClass}`,
    status: STATUS_LABELS[article.status],
    badge: isEco(article.fabricCodes, context.fabrics) ? { label: "Eco", tone: "ok" } : null,
    spread: spreadOf(article, context.colours),
    registryTypeId: article.registryTypeId,
  };
}

export const productCards = (articles: readonly BaseArticleSummary[], context: CardContext): readonly ProductCardView[] =>
  articles.map((article) => productCard(article, context));
