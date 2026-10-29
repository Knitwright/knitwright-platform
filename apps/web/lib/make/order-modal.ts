import { formatMoney, priceBasket, type Ladder } from "@/lib/factory/pricing";
import type { SellCurrency } from "@/lib/factory/schemas";
import { checkRun, type RunClass, type RunCheck } from "./run";
import { pieces, type MakeFinding } from "./vocabulary";

/**
 * The order modal, "Select sizes" (F-S7). It searches the brand's own products, filters them by production class or by
 * a date the factory data can actually produce, and prices one row per product and size with the tier read across
 * every piece in the basket (spec F-T5, `priceBasket`, decision 0071).
 *
 * There is no checkout here and no payment of any kind (owner decision 1): the footer shows the pieces, the total where
 * every line has a price, and the delivery date, and the button hands the order over to production.
 */

export interface OrderProduct {
  readonly productId: string;
  readonly name: string;
  /** The base article, or null when no base article covers the design's garment type. */
  readonly articleCode: string | null;
  readonly productionClass: RunClass;
  readonly sizes: readonly string[];
  readonly ladder: Ladder;
  /** The date from the factory data, or null while any part of it is not set. */
  readonly readyBy: string | null;
  /** "Made by Knitwright · Sialkot", built from the factory row, never written here. */
  readonly madeBy: string;
  readonly colourway: string;
}

export const CHIP_IDS = ["all", "class-a", "class-b", "ready-by"] as const;
export type ChipId = (typeof CHIP_IDS)[number];

export interface Chip {
  readonly id: ChipId;
  readonly label: string;
  /** False when nothing can match it: the chip is shown, switched off, with the reason. */
  readonly available: boolean;
}

/** The earliest date any product can be ready by, or null when the factory data gives none. */
export const earliestReadyBy = (products: readonly OrderProduct[]): string | null =>
  products.map((product) => product.readyBy).filter((date): date is string => date !== null).sort()[0] ?? null;

export function chipsFor(products: readonly OrderProduct[]): readonly Chip[] {
  const date = earliestReadyBy(products);
  return [
    { id: "all", label: "All", available: true },
    { id: "class-a", label: "Class A (from 1)", available: products.some((product) => product.productionClass === "A") },
    { id: "class-b", label: "Class B (runs)", available: products.some((product) => product.productionClass === "B") },
    { id: "ready-by", label: date === null ? "Ready to ship by: no date yet" : `Ready to ship by ${date}`, available: date !== null },
  ];
}

const matchesChip = (product: OrderProduct, chip: ChipId, date: string | null): boolean => {
  if (chip === "class-a") return product.productionClass === "A";
  if (chip === "class-b") return product.productionClass === "B";
  if (chip === "ready-by") return date !== null && product.readyBy !== null && product.readyBy <= date;
  return true;
};

const matchesQuery = (product: OrderProduct, query: string): boolean => {
  const wanted = query.trim().toLowerCase();
  if (wanted === "") return true;
  return [product.name, product.articleCode ?? "", product.colourway].some((text) => text.toLowerCase().includes(wanted));
};

/** "Search across my products", then the chips. The order of the products is kept. */
export function filterProducts(products: readonly OrderProduct[], query: string, chip: ChipId): readonly OrderProduct[] {
  const date = earliestReadyBy(products);
  return products.filter((product) => matchesQuery(product, query) && matchesChip(product, chip, date));
}

/** Pieces typed per product and size. The key is `lineKey`. */
export type Quantities = Readonly<Record<string, string>>;
export const lineKey = (productId: string, size: string): string => `${productId}:${size}`;

export interface OrderRow {
  readonly productId: string;
  readonly size: string;
  readonly qty: number;
  /** The unit price at the basket's quantity, or why there is none. */
  readonly unitText: string;
  readonly lineMinor: number | null;
}

export interface ProductSelection {
  readonly product: OrderProduct;
  readonly rows: readonly OrderRow[];
  readonly pieces: number;
  readonly check: RunCheck;
}

export interface Selection {
  readonly products: readonly ProductSelection[];
  readonly pieces: number;
  /** The sum of every line, or null while any line with pieces has no price. */
  readonly totalMinor: number | null;
  readonly currency: SellCurrency;
  /** The quantity the tiers were read at: every piece in the basket. */
  readonly tierQty: number;
  readonly findings: readonly MakeFinding[];
  readonly canSend: boolean;
}

const quantitiesOf = (product: OrderProduct, typed: Quantities): Readonly<Record<string, string>> =>
  Object.fromEntries(product.sizes.map((size) => [size, typed[lineKey(product.productId, size)] ?? ""]));

/** The total pieces of one product, from what was typed, counting only whole numbers above zero. */
const piecesOf = (check: RunCheck, typed: Readonly<Record<string, string>>): number => {
  const fromCheck = check.pieces;
  if (fromCheck > 0) return fromCheck;
  return Object.values(typed).reduce((sum, text) => {
    const value = Number(text.trim());
    return Number.isInteger(value) && value > 0 ? sum + value : sum;
  }, 0);
};

/**
 * Prices the whole selection. Each product's quantities are checked by the run rules first (so a Class B style outside
 * 50 to 300 is refused here as it is on the run page), and the tier is then read across every piece in the basket.
 */
export function priceSelection(products: readonly OrderProduct[], typed: Quantities, currency: SellCurrency): Selection {
  const parts = products.map((product) => {
    const quantities = quantitiesOf(product, typed);
    const check = checkRun({ quantities, productionClass: product.productionClass, moq: null });
    return { product, quantities, check, pieces: piecesOf(check, quantities) };
  });
  const ordered = parts.filter((part) => part.pieces > 0);
  const basket = priceBasket(
    ordered.map((part) => ({ articleCode: part.product.articleCode ?? part.product.productId, qty: part.pieces, ladder: part.product.ladder })),
    currency,
  );
  const priceByProduct = new Map(ordered.map((part, index) => [part.product.productId, basket.lines[index]!.price]));

  const selections = parts.map((part): ProductSelection => {
    const price = priceByProduct.get(part.product.productId);
    const unitText = price === undefined ? "" : price.status === "priced" ? `${formatMoney(price.unitMinor, price.currency)} per piece` : price.reason;
    return {
      product: part.product,
      rows: part.product.sizes.map((size) => {
        const qty = Number(part.quantities[size]?.trim() ?? "");
        const whole = Number.isInteger(qty) && qty > 0 ? qty : 0;
        return {
          productId: part.product.productId,
          size,
          qty: whole,
          unitText,
          lineMinor: whole > 0 && price?.status === "priced" ? price.unitMinor * whole : null,
        };
      }),
      pieces: part.pieces,
      check: part.check,
    };
  });

  const findings = ordered.flatMap((part) => part.check.findings);
  return {
    products: selections,
    pieces: ordered.reduce((sum, part) => sum + part.pieces, 0),
    totalMinor: basket.totalMinor,
    currency,
    tierQty: basket.tierQty,
    findings,
    canSend: ordered.length > 0 && ordered.every((part) => part.check.canSend),
  };
}

/** The footer line: the pieces, and the total where every line has a price. */
export const describeTotal = (selection: Selection): string =>
  selection.pieces === 0
    ? "Nothing selected yet."
    : selection.totalMinor === null
      ? `${pieces(selection.pieces)}. No total yet: a line has no price on file.`
      : `${pieces(selection.pieces)} · ${formatMoney(selection.totalMinor, selection.currency)}`;
