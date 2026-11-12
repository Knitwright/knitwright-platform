/** How the Orders area writes an order's number, a date and an amount (10 §10: "4 Dec"). */

/** "KW-3F9A21C0": the first eight characters of the order's id. Ops finds an order by the same id. */
export const orderNumber = (orderId: string): string => `KW-${orderId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "4 Dec", from an ISO date or time. */
export const shortDate = (iso: string): string => DAY.format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso));

/** "£625.00", in the currency given. A currency the runtime does not know is written as its code. */
export function money(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

/** "S4 · M9 · L8": sizes in size order with their pieces. */
export const sizesText = (sizes: Readonly<Record<string, number>>): string =>
  Object.entries(sizes)
    .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
    .map(([size, n]) => `${size}${n}`)
    .join(" · ");
