import { money, orderNumber, shortDate, sizesText } from "@/lib/order-desk/format";
import { reachedStep, STATUS_LABELS, STATUS_TONES, STEP_LABELS, TRACK_STEPS, type CustomerStatus } from "@/lib/order-desk/status";
import type { FieldProvenance } from "@/lib/techpack/view/fields";
import type { OrderStateSummary, TechPackSummary, TrackStepView } from "./types";

/**
 * The two boards' summaries (plan v6 E4, decision 0148), from rows that are already read. Pure, so
 * the sentences are tested without a database; `server.ts` does the reading.
 */

/** The pages a tech pack board draws as thumbnails: the prototype's eight (e20). */
export const THUMBNAIL_PAGES: readonly number[] = [1, 2, 4, 6, 9, 11, 14, 15];

/** Short names for a page thumbnail, which is 70 units wide on the board. */
const SHORT_TITLES: Readonly<Record<number, string>> = {
  1: "Overview",
  2: "Flats",
  4: "BOM",
  6: "Construction",
  9: "Grading",
  11: "Placement",
  14: "Colourways",
  15: "QC",
};

export interface TechPackInput {
  readonly designProjectId: string;
  readonly designName: string;
  readonly version: number;
  readonly pages: readonly Readonly<{ number: number; title: string }>[];
  readonly counts: Readonly<Record<FieldProvenance, number>>;
  readonly review: Readonly<{ exportBlocked: boolean; summary: string }>;
}

export function techPackSummary(input: TechPackInput): TechPackSummary {
  return {
    designProjectId: input.designProjectId,
    designName: input.designName,
    version: input.version,
    pages: input.pages.length,
    thumbnails: input.pages
      .filter((page) => THUMBNAIL_PAGES.includes(page.number))
      .map((page) => ({ number: page.number, title: SHORT_TITLES[page.number] ?? page.title })),
    needsInput: input.counts.needs_input,
    fromBase: input.counts.from_base,
    fromDesign: input.counts.from_design,
    exportBlocked: input.review.exportBlocked,
    reviewNote: input.review.summary,
  };
}

/** "16 pages · 1 field needs input" (e20). */
export function techPackLine(summary: TechPackSummary): string {
  const waiting =
    summary.needsInput === 0 ? "nothing waits for input" : summary.needsInput === 1 ? "1 field needs input" : `${summary.needsInput} fields need input`;
  return `${summary.pages} pages · ${waiting}`;
}

/** Every step of F-T7's timeline with whether this order has passed it, is at it, or has it ahead. */
export function trackSteps(status: CustomerStatus): readonly TrackStepView[] {
  const reached = reachedStep(status);
  return TRACK_STEPS.map((id, index) => ({
    id,
    label: STEP_LABELS[id],
    state: index < reached ? "done" : index === reached ? "current" : "todo",
  }));
}

export interface OrderInput {
  readonly id: string;
  readonly kind: "sample" | "run" | "order";
  readonly sizes: Readonly<Record<string, number>>;
  readonly pieces: number;
  readonly value: Readonly<{ minor: number; currency: string }> | null;
  readonly status: CustomerStatus;
  readonly readyOn: string | null;
  readonly createdAt: string;
}

const TITLES: Readonly<Record<OrderInput["kind"], string>> = { sample: "Sample order", run: "Run", order: "Order" };

const piecesText = (pieces: number): string => (pieces === 1 ? "1 piece" : `${pieces} pieces`);

/** The newest order of the ones given, as the Order board shows it; null when there is none. */
export function orderSummary(orders: readonly OrderInput[]): OrderStateSummary | null {
  const newest = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
  if (newest === undefined) return null;
  const parts = [
    piecesText(newest.pieces),
    newest.value === null ? "price on the invoice" : money(newest.value.minor, newest.value.currency),
    newest.readyOn === null ? "ready date not set" : `ready ${shortDate(newest.readyOn)}`,
  ];
  return {
    orderId: newest.id,
    number: orderNumber(newest.id),
    title: TITLES[newest.kind],
    line: parts.join(" · "),
    sizes: sizesText(newest.sizes),
    status: STATUS_LABELS[newest.status],
    tone: STATUS_TONES[newest.status],
    steps: trackSteps(newest.status),
    trackingHref: `/orders/${newest.id}`,
  };
}
