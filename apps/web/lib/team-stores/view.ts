import { formatMoney } from "@/lib/factory/pricing";
import { isPaid, type StorePurchase, type TeamStore } from "./model";
import { marginPercent, piecePriceMinor, storeAddress, whenText, windowState, type WindowState } from "./rules";

/**
 * What a club reads about one of its team stores (plan v6 C2, decision 0153): on the Order drawer's Team store tab
 * and on Team › Stores. Spec 09 screen 16's card: "closes in, sizes collected 18/25, club margin". Pure, so every
 * sentence is tested apart from the screens.
 */

export type Tone = "ok" | "warn" | "info" | "neutral";

export interface StoreCard {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly state: WindowState;
  readonly stateLabel: string;
  readonly tone: Tone;
  readonly when: string;
  /** "12 of 10 minimum" while open; what was sent or refunded after. */
  readonly progress: string;
  /** 0 to 100, the share of the minimum collected, for the bar. */
  readonly percent: number;
  readonly price: string;
  readonly margin: string;
  readonly link: string;
  /** True while the club may close or cancel it. */
  readonly canEnd: boolean;
  readonly message: string | null;
}

const STATE_LABELS: Readonly<Record<WindowState, Readonly<{ label: string; tone: Tone }>>> = {
  scheduled: { label: "Not open yet", tone: "info" },
  open: { label: "Open", tone: "ok" },
  due: { label: "Closing", tone: "info" },
  closing: { label: "Closing", tone: "info" },
  closed: { label: "Order sent", tone: "ok" },
  refunding: { label: "Refunding", tone: "warn" },
  refunded: { label: "Refunded", tone: "neutral" },
};

/** Paid pieces, from the purchases whose money is in. */
export const paidPieces = (purchases: readonly StorePurchase[]): number => purchases.filter(isPaid).reduce((sum, purchase) => sum + purchase.pieces, 0);

function marginLine(store: TeamStore): string {
  if (store.marginBps === 0) return "No club margin";
  const owed = store.marginOwedMinor !== null && store.status === "closed" ? ` · ${formatMoney(store.marginOwedMinor, store.currency)} to the club` : "";
  return `Club margin ${marginPercent(store.marginBps)} (${formatMoney(store.marginMinor, store.currency)} a piece)${owed}`;
}

export function storeCard(store: TeamStore, purchases: readonly StorePurchase[], now: Date, siteUrl: string): StoreCard {
  const state = windowState(store, now);
  const pieces = store.piecesSold ?? paidPieces(purchases);
  const progress = state === "refunded" || state === "refunding" ? `${pieces} pieces bought, ${store.minPieces} needed` : `${pieces} of ${store.minPieces} pieces minimum`;
  return {
    id: store.id,
    code: store.code,
    title: store.title,
    state,
    stateLabel: STATE_LABELS[state].label,
    tone: STATE_LABELS[state].tone,
    when: whenText(store, now),
    progress,
    percent: Math.min(100, Math.round((pieces / store.minPieces) * 100)),
    price: `${formatMoney(piecePriceMinor(store), store.currency)} a piece`,
    margin: marginLine(store),
    link: storeAddress(siteUrl, store.code),
    canEnd: state === "open" || state === "scheduled",
    message: store.closeMessage,
  };
}

/** One row of the names and numbers list the club and the factory read. */
export interface NameRow {
  readonly key: string;
  readonly size: string;
  readonly name: string;
  readonly number: string;
  readonly buyer: string;
}

/** Every paid piece with its size, shirt name and number, in the order they were bought. */
export const namesList = (purchases: readonly StorePurchase[]): readonly NameRow[] =>
  purchases.filter(isPaid).flatMap((purchase) =>
    purchase.lines.map((line, index) => ({
      key: `${purchase.id}:${index}`,
      size: line.sizeLabel,
      name: line.printName.toUpperCase(),
      number: line.printNumber,
      buyer: purchase.buyerName,
    })),
  );
