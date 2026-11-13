import { MAX_PIECES_PER_ORDER, type PurchaseLine, type TeamStore } from "./model";

/**
 * THE RULES OF A TEAM STORE (plan v6 C2, decision 0153; spec F-T6), pure so every one is tested without a
 * database. The database keeps the same rules again (`open_team_store_payment`, `begin_team_store_close`); these
 * are for telling a person what is wrong before anything is sent.
 */

/** The club's margin on one piece, rounded half up, exactly as `open_team_store` works it out. */
export const marginMinorOf = (unitMinor: number, marginBps: number): number => Math.floor((unitMinor * marginBps + 5000) / 10000);

/** What a buyer pays for one piece: the base price and the club's margin on top (F-T6). */
export const piecePriceMinor = (store: Pick<TeamStore, "unitMinor" | "marginMinor">): number => store.unitMinor + store.marginMinor;

/** "10%" for 1000 basis points. */
export const marginPercent = (bps: number): string => `${bps / 100}%`;

/** Where a store stands at a moment, as a person reads it. `due`: its close time has come and the close has not run yet. */
export type WindowState = "scheduled" | "open" | "due" | TeamStore["status"];

export function windowState(store: Pick<TeamStore, "status" | "opensAt" | "closesAt">, now: Date): WindowState {
  if (store.status !== "open") return store.status;
  if (now.getTime() < Date.parse(store.opensAt)) return "scheduled";
  if (now.getTime() >= Date.parse(store.closesAt)) return "due";
  return "open";
}

/** True while the store takes orders. */
export const isTakingOrders = (store: Pick<TeamStore, "status" | "opensAt" | "closesAt">, now: Date): boolean => windowState(store, now) === "open";

export const isStoreCode = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9]{10}$/.test(value);

/** The address players and parents open. */
export const storeAddress = (siteUrl: string, code: string): string => `${siteUrl.replace(/\/+$/, "")}/t/${code}`;

export type LineProblem = Readonly<{ index: number; field: "size" | "name" | "number"; message: string }>;

type StoreLimits = Pick<TeamStore, "sizes" | "namesNumbers" | "nameMax" | "numberMin" | "numberMax">;

function lineProblems(store: StoreLimits, line: PurchaseLine, index: number): LineProblem[] {
  const problems: LineProblem[] = [];
  if (!store.sizes.includes(line.sizeLabel)) problems.push({ index, field: "size", message: "Choose one of the sizes on offer." });
  if (!store.namesNumbers) {
    if (line.printName !== "" || line.printNumber !== "") problems.push({ index, field: "name", message: "This store prints no names or numbers." });
    return problems;
  }
  if (line.printName.length > store.nameMax) {
    problems.push({ index, field: "name", message: `A shirt name here fits ${store.nameMax} characters. This one has ${line.printName.length}.` });
  }
  if (line.printNumber !== "") {
    const value = /^[0-9]{1,3}$/.test(line.printNumber) ? Number(line.printNumber) : Number.NaN;
    if (!(value >= store.numberMin && value <= store.numberMax)) {
      problems.push({ index, field: "number", message: `A number here is ${store.numberMin} to ${store.numberMax}.` });
    }
  }
  return problems;
}

/** Everything wrong with a purchase before it is sent, line by line. Empty when it may go. */
export function checkPurchase(store: StoreLimits, lines: readonly PurchaseLine[]): readonly LineProblem[] {
  if (lines.length === 0) return [{ index: 0, field: "size", message: "Add a piece first." }];
  if (lines.length > MAX_PIECES_PER_ORDER) return [{ index: MAX_PIECES_PER_ORDER, field: "size", message: `One order is up to ${MAX_PIECES_PER_ORDER} pieces.` }];
  return lines.flatMap((line, index) => lineProblems(store, line, index));
}

/** The pieces of every paid purchase, by size, as the close will count them. */
export function sizesOf(lines: readonly Pick<PurchaseLine, "sizeLabel">[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const line of lines) counts[line.sizeLabel] = (counts[line.sizeLabel] ?? 0) + 1;
  return counts;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Closes in 3 days", "Closes today", "Opens in 2 days", or what happened. */
export function whenText(store: Pick<TeamStore, "status" | "opensAt" | "closesAt">, now: Date): string {
  const state = windowState(store, now);
  const days = (iso: string) => Math.ceil((Date.parse(iso) - now.getTime()) / DAY_MS);
  const inDays = (n: number) => (n <= 1 ? (n === 1 ? "in 1 day" : "today") : `in ${n} days`);
  if (state === "scheduled") return `Opens ${inDays(days(store.opensAt))}`;
  if (state === "open") return `Closes ${inDays(days(store.closesAt))}`;
  if (state === "due" || state === "closing") return "Closing now";
  if (state === "closed") return "Closed: one order sent to production";
  if (state === "refunding") return "Closed: refunding everyone who paid";
  return "Closed: everyone who paid was refunded";
}
