import type { RosterRow } from "@/lib/production/contract";
import type { Batch, OpsOrder } from "../rows";
import { DEFAULT_SETTINGS_LABEL, describeCutoff, type OpsSettings } from "../settings";

export interface SheetOrderInput {
  readonly order: OpsOrder;
  readonly brandName: string;
  /** The team list, or null when there is none or it was erased. */
  readonly roster: readonly RosterRow[] | null;
}

export interface SheetInput {
  readonly batch: Batch;
  readonly orders: readonly SheetOrderInput[];
  readonly settings: OpsSettings;
}

export const NOT_SET = "Not set";

/** Packing text is a labelled default: nobody at a factory has agreed it. Owner question O5. */
const PACKING_DEFAULT: readonly string[] = [
  "Fold flat and bag each order separately. Put the order reference on the outside of the bag.",
  "Where an order has a name and number list, bag each player's piece on its own and mark the bag with that name and number.",
  "Pack the orders of this batch together and mark the carton with the batch cut-off date.",
];
const PACKING_LABEL = `Packing instructions: ${DEFAULT_SETTINGS_LABEL}.`;

export interface SheetModel {
  readonly title: string;
  readonly subtitle: string;
  readonly cutoffLine: string;
  /** Earliest promised date among the orders, or "Not set". */
  readonly dueDate: string;
  readonly dueNote: string | null;
  readonly orders: readonly { ref: string; brand: string; release: string; pieces: number; promised: string }[];
  readonly sizes: readonly string[];
  readonly breakdown: readonly { ref: string; counts: readonly number[]; total: number }[];
  readonly totals: Readonly<{ counts: readonly number[]; total: number }>;
  readonly bom: readonly { item: string; quantity: string; source: string }[];
  readonly names: readonly { ref: string; notice: string | null; rows: readonly RosterRow[] }[];
  readonly packing: readonly string[];
  readonly packingLabel: string;
  readonly warnings: readonly string[];
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const sizeOrder = (a: string, b: string): number => a.localeCompare(b, "en", { numeric: true });

const rosterPieces = (rows: readonly RosterRow[]): number => rows.reduce((n, r) => n + r.quantity, 0);

function namesFor(input: SheetOrderInput): SheetModel["names"][number] {
  const ref = input.order.externalRef;
  if (input.roster === null) return { ref, notice: "No name and number list: this order has none, or it was erased.", rows: [] };
  const rows = [...input.roster].sort((a, b) => Number(a.number) - Number(b.number) || byText(a.name, b.name));
  return { ref, notice: null, rows };
}

function warningsFor(inputs: readonly SheetOrderInput[]): string[] {
  const found: string[] = [];
  for (const { order, roster } of inputs) {
    if (roster !== null && rosterPieces(roster) !== order.pieces) {
      found.push(`${order.externalRef}: the name and number list has ${rosterPieces(roster)} pieces and the order says ${order.pieces}. Ask before cutting.`);
    }
  }
  return found;
}

/** The content of one batch's factory sheet. Pure and deterministic: the same inputs give the same sheet. */
export function buildSheet(input: SheetInput): SheetModel {
  const inputs = [...input.orders].sort((a, b) => byText(a.order.externalRef, b.order.externalRef));
  const sizes = [...new Set(inputs.flatMap((i) => Object.keys(i.order.sizes)))].sort(sizeOrder);
  const breakdown = inputs.map((i) => ({ ref: i.order.externalRef, counts: sizes.map((s) => i.order.sizes[s] ?? 0), total: i.order.pieces }));
  const totals = { counts: sizes.map((_, n) => breakdown.reduce((sum, row) => sum + (row.counts[n] ?? 0), 0)), total: breakdown.reduce((sum, row) => sum + row.total, 0) };
  const promised = inputs.map((i) => i.order.promisedOn).filter((d): d is string => d !== null).sort(byText);
  const { batch, settings } = input;
  return {
    title: `Factory sheet: ${batch.articleId}`,
    subtitle: `${batch.factoryProfileId} · fabric ${batch.fabricKey} · ${totals.total} pieces in ${inputs.length} orders`,
    cutoffLine: `Batch cut-off ${batch.cutoffAt.slice(0, 10)} (weekly cut-off ${describeCutoff(settings)}). ${settings.label === DEFAULT_SETTINGS_LABEL ? `Cut-off: ${DEFAULT_SETTINGS_LABEL}.` : `Cut-off set by: ${settings.label}.`}`,
    dueDate: promised[0] ?? NOT_SET,
    dueNote: promised.length === 0 ? "No lead time has been set, so no due date is promised yet." : null,
    orders: inputs.map((i) => ({ ref: i.order.externalRef, brand: i.brandName, release: `${i.order.release.label} (release ${i.order.release.number})`, pieces: i.order.pieces, promised: i.order.promisedOn ?? NOT_SET })),
    sizes,
    breakdown,
    totals,
    bom: [
      { item: `Fabric ${batch.fabricKey}`, quantity: `${NOT_SET}: needs a cut plan`, source: "The platform does not yet work out metres of fabric." },
      { item: "Trims, labels and packaging", quantity: NOT_SET, source: "The platform holds no trim list yet." },
    ],
    names: inputs.map(namesFor),
    packing: PACKING_DEFAULT,
    packingLabel: PACKING_LABEL,
    warnings: warningsFor(inputs),
  };
}
