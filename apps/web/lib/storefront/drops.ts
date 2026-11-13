import { z } from "zod";
import type { CollectionPlan } from "@/lib/collections/types";

/**
 * DROPS (spec F-L5 "Drop: pre-order window with open/close dates and an optional target. Buyers pay at order. At
 * close the drop becomes one Class A or B batch. A drop can be created from a collection plan (F-S10)").
 *
 * A drop opens and closes a set of listings. While it is open, its listings sell; outside it, a drop listing does
 * not (the database refuses the order, `drop_closed`). At close each listing's paid orders become one batch
 * (`batching.ts`).
 */

export type DropStatus = "scheduled" | "closed" | "cancelled";

export interface Drop {
  readonly id: string;
  readonly brandId: string;
  readonly collectionId: string | null;
  readonly name: string;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly targetUnits: number | null;
  readonly status: DropStatus;
}

/** What a person reads: not yet open, open now, waiting to be batched, closed, or cancelled. */
export type DropState = "upcoming" | "open" | "closing" | "closed" | "cancelled";

export function dropState(drop: Pick<Drop, "opensAt" | "closesAt" | "status">, now: Date): DropState {
  if (drop.status === "cancelled") return "cancelled";
  if (drop.status === "closed") return "closed";
  const at = now.getTime();
  if (at < Date.parse(drop.opensAt)) return "upcoming";
  return at < Date.parse(drop.closesAt) ? "open" : "closing";
}

export const DROP_STATE_LABELS: Readonly<Record<DropState, string>> = {
  upcoming: "Opens soon",
  open: "Open",
  closing: "Closed, batching",
  closed: "Closed",
  cancelled: "Cancelled",
};

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** "Closes in 3 days", "Opens in 5 hours", "Closed". */
export function countdown(drop: Pick<Drop, "opensAt" | "closesAt" | "status">, now: Date): string {
  const state = dropState(drop, now);
  if (state !== "upcoming" && state !== "open") return DROP_STATE_LABELS[state];
  const target = Date.parse(state === "upcoming" ? drop.opensAt : drop.closesAt);
  const left = Math.max(0, target - now.getTime());
  const words = left >= DAY ? plural(Math.floor(left / DAY), "day") : left >= HOUR ? plural(Math.floor(left / HOUR), "hour") : plural(Math.max(1, Math.ceil(left / 60_000)), "minute");
  return `${state === "upcoming" ? "Opens" : "Closes"} in ${words}`;
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "18 of 30 pre-orders", or "18 pre-orders" with no target. */
export const progressLine = (sold: number, target: number | null): string => (target === null ? `${sold} pre-${sold === 1 ? "order" : "orders"}` : `${sold} of ${target} pre-orders`);

/** The share of the target sold, 0–100, or null with no target. */
export const progressPercent = (sold: number, target: number | null): number | null => (target === null || target <= 0 ? null : Math.min(100, Math.round((sold * 100) / target)));

export interface DropFromPlan {
  /** The listings the drop opens, with each style's planned pieces as its target. */
  readonly listings: readonly Readonly<{ listingId: string; targetUnits: number | null }>[];
  /** Styles that cannot be in the drop, and why, so nothing is skipped silently. */
  readonly left: readonly Readonly<{ style: string; reason: string }>[];
  readonly targetUnits: number | null;
}

/**
 * The listings a plan's drop opens: each style's product's listing, with the style's planned pieces as its target
 * ("Create drop from the plan, with quantities as targets"). A style with no product, or whose product has no
 * listing yet, is named in `left` rather than left out without a word.
 */
export function dropFromPlan(plan: CollectionPlan, listingOf: ReadonlyMap<string, string>): DropFromPlan {
  const listings = new Map<string, number>();
  const left: { style: string; reason: string }[] = [];
  for (const style of plan.styles) {
    const units = style.sizes.reduce((sum, size) => sum + Math.max(0, size.qty), 0);
    const listingId = style.productId === null ? undefined : listingOf.get(style.productId);
    if (style.productId === null) left.push({ style: style.name, reason: "has no product yet" });
    else if (listingId === undefined) left.push({ style: style.name, reason: "has no listing yet" });
    else listings.set(listingId, (listings.get(listingId) ?? 0) + units);
  }
  const rows = [...listings].map(([listingId, units]) => ({ listingId, targetUnits: units > 0 ? units : null }));
  const total = rows.reduce((sum, row) => sum + (row.targetUnits ?? 0), 0);
  return { listings: rows, left, targetUnits: total > 0 ? total : null };
}

const WHEN = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/** "20 Nov, 10:00 – 27 Nov, 10:00 UTC". */
export const windowLine = (drop: Pick<Drop, "opensAt" | "closesAt">): string => `${WHEN.format(new Date(drop.opensAt))} – ${WHEN.format(new Date(drop.closesAt))} UTC`;

export interface DropCardView {
  readonly id: string;
  readonly name: string;
  readonly state: string;
  readonly when: string;
  readonly progress: string;
  readonly percent: number | null;
  readonly cancellable: boolean;
}

/** The drop cards of the storefront page: state, countdown and window, pre-orders against the target. */
export function dropCards(drops: readonly Drop[], sold: ReadonlyMap<string, number>, now: Date): readonly DropCardView[] {
  return drops.map((drop) => {
    const state = dropState(drop, now);
    const count = sold.get(drop.id) ?? 0;
    return {
      id: drop.id,
      name: drop.name,
      state: DROP_STATE_LABELS[state],
      when: `${countdown(drop, now)} · ${windowLine(drop)}`,
      progress: progressLine(count, drop.targetUnits),
      percent: progressPercent(count, drop.targetUnits),
      cancellable: state === "upcoming",
    };
  });
}

/** True when a drop sells now: shoppers can buy a drop listing only then. */
export const isOpen = (drop: Pick<Drop, "opensAt" | "closesAt" | "status">, now: Date): boolean => dropState(drop, now) === "open";

/** The drop that matters to a shopper: the open one, else the next to open, else none. */
export function currentDrop(drops: readonly Drop[], now: Date): Drop | null {
  const open = drops.find((drop) => dropState(drop, now) === "open");
  if (open) return open;
  const upcoming = drops.filter((drop) => dropState(drop, now) === "upcoming").sort((a, b) => a.opensAt.localeCompare(b.opensAt));
  return upcoming[0] ?? null;
}

/**
 * What the storefront says under a product, or null to leave it out of the grid. A drop listing with "Hide in store
 * until ready" is shown only while one of its drops is open; without it, it shows when its next drop opens.
 */
export function saleNote(listing: Readonly<{ mode: "made_to_order" | "drop"; hideUntilReady: boolean }>, drops: readonly Drop[], now: Date): string | null {
  if (listing.mode === "made_to_order") return "Made to order";
  const drop = currentDrop(drops, now);
  if (drop === null) return listing.hideUntilReady ? null : "Not on sale yet";
  const open = dropState(drop, now) === "open";
  if (!open && listing.hideUntilReady) return null;
  return open ? `Pre-order · ${countdown(drop, now)}` : countdown(drop, now);
}

const LONGEST_DROP_DAYS = 90;

export const newDropBody = z
  .object({
    collectionId: z.uuid("Choose a collection plan."),
    name: z.string().trim().min(1, "Name the drop.").max(80),
    opensAt: z.iso.datetime({ offset: true, local: true }),
    closesAt: z.iso.datetime({ offset: true, local: true }),
  })
  .refine((body) => Date.parse(body.closesAt) > Date.parse(body.opensAt), { message: "A drop closes after it opens.", path: ["closesAt"] })
  .refine((body) => Date.parse(body.closesAt) - Date.parse(body.opensAt) <= LONGEST_DROP_DAYS * DAY, {
    message: `A drop is open for at most ${LONGEST_DROP_DAYS} days.`,
    path: ["closesAt"],
  });
export type NewDrop = z.output<typeof newDropBody>;
