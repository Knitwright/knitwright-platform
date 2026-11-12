import type { ProductView } from "@/lib/brand-runs/service";
import type { CollectionPlan } from "@/lib/collections/types";
import { GOLDEN_SAMPLE_STATE_LABELS } from "@/lib/make/vocabulary";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/ops/status";
import type { QuoteLineRef } from "@/lib/quotes/download";
import type { CustomerOrder } from "./service";
import { customerStatus, matchesFilter, NO_MILESTONES, STATUS_LABELS, type FilterId } from "./status";

/** The lists of the Orders tabs, from what the service and the existing readers give (decision 0143). */

const SEARCH_MAX = 80;

/** The orders a chip and a search leave. The search matches the number, the product and the customer. */
export function filterOrders(orders: readonly CustomerOrder[], filter: FilterId, query: string, customer: string): readonly CustomerOrder[] {
  const words = query.trim().slice(0, SEARCH_MAX).toLowerCase();
  return orders.filter(
    (order) =>
      matchesFilter(filter, order.status) &&
      (words === "" || [order.number, order.productName, customer].some((text) => text.toLowerCase().includes(words))),
  );
}

export interface SampleEntry {
  readonly id: string;
  readonly kind: "sample" | "golden";
  readonly productName: string;
  readonly projectId: string;
  /** "M1 · L1" for a sample; "Version 2" for a golden sample. */
  readonly detail: string;
  readonly status: string;
  readonly at: string;
  /** Where the sample is worked on. */
  readonly href: string;
}

export interface GoldenSample {
  readonly id: string;
  readonly productId: string;
  readonly version: number;
  readonly state: string;
  readonly createdAt: string;
}

const GOLDEN_STATES: Readonly<Record<string, string>> = GOLDEN_SAMPLE_STATE_LABELS;

/** Where a sample's order is, in the customer's words; a state this page does not know reads as sent. */
const sampleStatus = (status: string): string =>
  (ORDER_STATUSES as readonly string[]).includes(status) ? STATUS_LABELS[customerStatus(status as OrderStatus, NO_MILESTONES)] : "Sent to production";

const sizesOf = (sizes: Readonly<Record<string, number>>): string =>
  Object.entries(sizes)
    .map(([size, n]) => `${size}${n}`)
    .join(" · ");

/** Every sample ordered and every golden sample judged, newest first. */
export function sampleEntries(products: readonly ProductView[], golden: readonly GoldenSample[]): readonly SampleEntry[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const samples = products.flatMap((product) =>
    product.runs
      .filter((run) => run.kind === "sample")
      .map((run): SampleEntry => ({
        id: run.id,
        kind: "sample",
        productName: product.name,
        projectId: product.projectId,
        detail: sizesOf(run.sizes),
        status: run.order === null ? "Sent to production" : sampleStatus(run.order.status),
        at: run.createdAt,
        href: `/studio/${product.projectId}/make/sample`,
      })),
  );
  const judged = golden.flatMap((g): SampleEntry[] => {
    const product = byId.get(g.productId);
    if (!product) return [];
    return [{ id: g.id, kind: "golden", productName: product.name, projectId: product.projectId, detail: `Version ${g.version}`, status: GOLDEN_STATES[g.state] ?? g.state, at: g.createdAt, href: `/studio/${product.projectId}/make/golden-sample` }];
  });
  return [...samples, ...judged].sort((a, b) => b.at.localeCompare(a.at));
}

export interface QuoteBasket {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly currency: string;
  readonly lines: readonly QuoteLineRef[];
  readonly unpriced: readonly string[];
  readonly pieces: number;
}

const ARTICLE = /^[A-Z]{3}-[A-Z]{2}-[0-9]{2}$/;
const QUOTE_LINES_MAX = 8;

/** A plan's styles summed per article; styles with no article code are named as unpriced. */
export function planBasket(plan: CollectionPlan): QuoteBasket {
  const totals = new Map<string, number>();
  const unpriced: string[] = [];
  for (const style of plan.styles) {
    const qty = style.sizes.reduce((sum, size) => sum + size.qty, 0);
    if (style.articleCode !== null && ARTICLE.test(style.articleCode) && qty > 0) totals.set(style.articleCode, (totals.get(style.articleCode) ?? 0) + qty);
    else unpriced.push(style.name);
  }
  const lines = [...totals.entries()].slice(0, QUOTE_LINES_MAX).map(([articleCode, qty]) => ({ articleCode, qty: Math.min(qty, 99_999) }));
  return { id: plan.id, title: plan.name, source: "Collection plan", currency: plan.currency, lines, unpriced: unpriced.slice(0, QUOTE_LINES_MAX), pieces: lines.reduce((s, l) => s + l.qty, 0) };
}

/** An order of a catalogue article, quoted again at today's tiers. Null for an article the catalogue does not code. */
export function orderBasket(order: CustomerOrder, currency: string): QuoteBasket | null {
  if (!ARTICLE.test(order.articleId)) return null;
  const qty = Math.min(order.pieces, 99_999);
  return { id: order.id, title: `${order.number} · ${order.productName}`, source: "Order, at today's tiers", currency, lines: [{ articleCode: order.articleId, qty }], unpriced: [], pieces: qty };
}
