import type { Batch, OpsOrder } from "./rows";
import type { OrderSummary } from "./grouping";
import { STATUS_LABELS, type OrderStatus } from "./status";

/** A value the Store gave, in the currency it gave it in. "Not given" when the Store gave none. */
export function formatValue(value: OrderSummary["value"] | Readonly<{ minor: number; currency: string }> | null): string {
  if (value === null) return "Not given";
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: value.currency }).format(value.minor / 100);
  } catch {
    return `${value.currency} ${(value.minor / 100).toFixed(2)}`;
  }
}

export const orderValue = (o: Pick<OpsOrder, "valueMinor" | "currency">): string =>
  formatValue(o.valueMinor === null || o.currency === null ? null : { minor: o.valueMinor, currency: o.currency });

export const sizesLine = (sizes: Readonly<Record<string, number>>): string =>
  Object.entries(sizes)
    .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
    .map(([size, n]) => `${size} ×${n}`)
    .join(", ");

export const batchLabel = (b: Pick<Batch, "articleId" | "fabricKey" | "factoryProfileId" | "cutoffAt">): string => `${b.articleId}, ${b.fabricKey}, ${b.factoryProfileId}, cut-off ${b.cutoffAt.slice(0, 10)}`;

export const statusCounts = (byStatus: Readonly<Partial<Record<OrderStatus, number>>>): string =>
  Object.entries(byStatus)
    .map(([status, n]) => `${n} ${STATUS_LABELS[status as OrderStatus].toLowerCase()}`)
    .join(", ");
