import type { OrderStatus } from "./status";

export interface GroupableOrder {
  readonly id: string;
  readonly factoryProfileId: string;
  readonly fabricKey: string;
  readonly articleId: string;
  /** ISO time of the cut-off the order falls under. */
  readonly cutoffAt: string;
  readonly status: OrderStatus;
  readonly pieces: number;
  readonly sizes: Readonly<Record<string, number>>;
  readonly valueMinor: number | null;
  readonly currency: string | null;
}

export interface OrderGroup {
  readonly factoryProfileId: string;
  readonly fabricKey: string;
  readonly articleId: string;
  readonly cutoffAt: string;
  readonly orderIds: readonly string[];
}

const keyOf = (o: GroupableOrder): string => JSON.stringify([o.factoryProfileId, o.fabricKey, o.articleId, o.cutoffAt]);

/**
 * The batches the orders waiting at `now` make. An order joins a group when it is waiting for a batch
 * (not held, not already in one) and its cut-off has come. The SQL function `cut_batches` does the same.
 * The result does not depend on the order the orders come in.
 */
export function groupOrdersForCutoff(orders: readonly GroupableOrder[], now: Date): readonly OrderGroup[] {
  const groups = new Map<string, OrderGroup>();
  const ready = orders.filter((o) => o.status === "submitted" && Date.parse(o.cutoffAt) <= now.getTime());
  for (const o of [...ready].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const key = keyOf(o);
    const found = groups.get(key);
    groups.set(key, found ? { ...found, orderIds: [...found.orderIds, o.id] } : { factoryProfileId: o.factoryProfileId, fabricKey: o.fabricKey, articleId: o.articleId, cutoffAt: o.cutoffAt, orderIds: [o.id] });
  }
  return [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, g]) => g);
}

export interface OrderSummary {
  readonly pieces: number;
  readonly sizes: Readonly<Record<string, number>>;
  /** Null when any order has no value or the currencies differ: a partial sum would mislead. */
  readonly value: Readonly<{ minor: number; currency: string }> | null;
}

export function summariseOrders(orders: readonly Pick<GroupableOrder, "pieces" | "sizes" | "valueMinor" | "currency">[]): OrderSummary {
  const sizes: Record<string, number> = {};
  for (const o of orders) for (const [size, n] of Object.entries(o.sizes)) sizes[size] = (sizes[size] ?? 0) + n;
  const currencies = new Set(orders.map((o) => o.currency));
  const priced = orders.length > 0 && orders.every((o) => o.valueMinor !== null) && currencies.size === 1 && !currencies.has(null);
  return {
    pieces: orders.reduce((n, o) => n + o.pieces, 0),
    sizes: Object.fromEntries(Object.entries(sizes).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))),
    value: priced ? { minor: orders.reduce((n, o) => n + (o.valueMinor ?? 0), 0), currency: [...currencies][0] as string } : null,
  };
}
