import type { OrderStatus } from "../status";

interface ShipmentLike {
  readonly sizes: Readonly<Record<string, number>>;
  readonly pieces: number;
}

type Fulfilment = "not_shipped" | "part_shipped" | "shipped";

export const FULFILMENT_LABELS: Readonly<Record<Fulfilment, string>> = {
  not_shipped: "Not shipped",
  part_shipped: "Part shipped",
  shipped: "Shipped",
};

/** Pieces sent so far, by size. */
export function shippedSizes(shipments: readonly ShipmentLike[]): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const s of shipments) for (const [size, n] of Object.entries(s.sizes)) out[size] = (out[size] ?? 0) + n;
  return out;
}

/** What the order still owes, by size. Sizes already covered are left out. */
export function remainingSizes(ordered: Readonly<Record<string, number>>, shipments: readonly ShipmentLike[]): Readonly<Record<string, number>> {
  const sent = shippedSizes(shipments);
  return Object.fromEntries(Object.entries(ordered).map(([size, n]) => [size, n - (sent[size] ?? 0)]).filter(([, n]) => (n as number) > 0));
}

export const sumSizes = (sizes: Readonly<Record<string, number>>): number => Object.values(sizes).reduce((n, v) => n + v, 0);

/**
 * An order is shipped when its shipments cover its pieces. Orders keep the status the factory set ("ready") because
 * `ops_orders` belongs to part 1; shipping is read from the shipments.
 */
export function fulfilmentOf(order: Readonly<{ pieces: number }>, shipments: readonly ShipmentLike[]): Fulfilment {
  const sent = shipments.reduce((n, s) => n + s.pieces, 0);
  return sent === 0 ? "not_shipped" : sent >= order.pieces ? "shipped" : "part_shipped";
}

/** Why a parcel cannot be recorded now, as a sentence, or null. The database checks the same things. */
export function shipBlocker(input: Readonly<{ status: OrderStatus; latestQc: "pass" | "fail" | null; fulfilment: Fulfilment }>): string | null {
  if (input.fulfilment === "shipped") return "Every piece of this order has been shipped.";
  if (input.status !== "ready") return "Only an order the factory has marked ready can be shipped.";
  if (input.latestQc === null) return "This order has not been inspected. Shipping waits for an inspection that passes.";
  if (input.latestQc === "fail") return "The latest inspection of this order failed, so it cannot ship. Inspect it again after the remake.";
  return null;
}

/** Sizes that go over what the order still owes, as sentences. Empty when the parcel fits. */
export function overShipped(remaining: Readonly<Record<string, number>>, parcel: Readonly<Record<string, number>>): readonly string[] {
  return Object.entries(parcel)
    .filter(([size, n]) => n > (remaining[size] ?? 0))
    .map(([size, n]) => `Size ${size}: ${n} in the parcel, ${remaining[size] ?? 0} still owed.`);
}
