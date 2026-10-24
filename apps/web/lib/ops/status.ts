export const ORDER_STATUSES = ["submitted", "batched", "held", "received", "in_production", "ready"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  submitted: "Waiting for a batch",
  batched: "In a batch",
  held: "On hold",
  received: "Received by the factory",
  in_production: "In production",
  ready: "Ready",
};

const FORWARD: Readonly<Partial<Record<OrderStatus, OrderStatus>>> = {
  batched: "received",
  received: "in_production",
  in_production: "ready",
};

/** The one status an order may be marked next, or null. The SQL function `ops_set_order_status` allows the same steps. */
export const nextStatus = (from: OrderStatus): OrderStatus | null => FORWARD[from] ?? null;

export const isForwardStep = (from: OrderStatus, to: OrderStatus): boolean => FORWARD[from] === to;

/** Ops may hold an order only before the factory has it. */
export const canHold = (s: OrderStatus): boolean => s === "submitted" || s === "batched";
export const canReleaseHold = (s: OrderStatus): boolean => s === "held";
export const canMove = (s: OrderStatus): boolean => s === "submitted" || s === "batched" || s === "held";
export const canDelay = (s: OrderStatus): boolean => s === "batched" || s === "received" || s === "in_production";

export const DELAY_REASON_MAX = 300;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (text: string): boolean => {
  const time = Date.parse(`${text}T00:00:00Z`);
  return isoDate.test(text) && !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === text;
};

/** A sentence saying what is wrong with a delay, or null when it is acceptable. A delay moves the date later and says why. */
export function checkDelay(delay: Readonly<{ current: string | null; next: string; reason: string }>): string | null {
  const reason = delay.reason.trim();
  if (reason.length === 0 || reason.length > DELAY_REASON_MAX) return `Give the reason for the delay, up to ${DELAY_REASON_MAX} characters.`;
  if (!isRealDate(delay.next)) return "Give the new promised date as a real date, year-month-day.";
  if (delay.current !== null && delay.next <= delay.current) return "The new promised date must be later than the current one.";
  return null;
}
