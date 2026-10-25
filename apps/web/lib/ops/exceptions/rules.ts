export const EXCEPTION_KINDS = ["remake", "partial_shipment", "lost_parcel", "size_swap"] as const;
export type ExceptionKind = (typeof EXCEPTION_KINDS)[number];

export const EXCEPTION_LABELS: Readonly<Record<ExceptionKind, string>> = {
  remake: "Remake",
  partial_shipment: "Partial shipment",
  lost_parcel: "Lost parcel",
  size_swap: "Size swap",
};

export const NOTE_MAX = 300;
export const OWNER_MAX = 80;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date, year-month-day. */
export const isRealDate = (text: string): boolean => {
  const time = Date.parse(`${text}T00:00:00Z`);
  return DATE.test(text) && !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === text;
};

/** Today in UTC as year-month-day. */
export const today = (now: Date): string => now.toISOString().slice(0, 10);

/** An open exception is overdue the day after it was due. */
export const isOverdue = (e: Readonly<{ status: "open" | "resolved"; dueOn: string }>, now: Date): boolean => e.status === "open" && e.dueOn < today(now);

/** A sentence saying what is wrong with an owner and due date, or null. Every exception has both. */
export function checkOwnerAndDue(owner: string, dueOn: string): string | null {
  const name = owner.trim();
  if (name.length === 0 || name.length > OWNER_MAX) return `Give an owner, a name of up to ${OWNER_MAX} characters.`;
  if (!isRealDate(dueOn)) return "Give the due date as a real date, year-month-day.";
  return null;
}

/** Overdue first (oldest due date first), then the rest by due date, then by id so the order never wobbles. */
export function sortForWork<T extends Readonly<{ id: string; status: "open" | "resolved"; dueOn: string }>>(list: readonly T[]): readonly T[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : a.id < b.id ? -1 : 1;
  });
}
