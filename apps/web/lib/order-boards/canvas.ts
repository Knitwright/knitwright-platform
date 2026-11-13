import { inputsOf, isGarmentKind, isLinkedKind, type BoardView, type Graph } from "@/lib/launch";
import { SPORTS } from "@/lib/teamwear/vocabulary";
import type { GarmentPreview } from "@/lib/canvas/types";
import type { OrderableDesign } from "./types";

/**
 * Which design the Order drawer, the Export popover and the Share popover act on, and what each of
 * them offers for it (plan v6 E4, decision 0148). Pure, so every rule is tested on its own.
 */

/** A garment board's design id, or null. */
export const designOfBoard = (board: BoardView | undefined): string | null => {
  const value = board?.settings["designProjectId"];
  return board !== undefined && isGarmentKind(board.kind) && typeof value === "string" && value.length > 0 ? value : null;
};

/** The design behind a tech pack or an order board: the garment board connected into it. */
export function linkedDesignOf(graph: Graph, board: BoardView): string | null {
  for (const edge of inputsOf(graph, board.id)) {
    const design = designOfBoard(graph.boards.find((one) => one.id === edge.fromBoardId));
    if (design !== null) return design;
  }
  return null;
}

/** The designs on this canvas that could be read, in board order. */
export function designsOf(graph: Graph, garments: Readonly<Record<string, GarmentPreview | null>>): readonly OrderableDesign[] {
  const seen = new Set<string>();
  const designs: OrderableDesign[] = [];
  for (const board of graph.boards) {
    const id = board.settings["designProjectId"];
    const preview = typeof id === "string" ? garments[id] : null;
    if (!preview || seen.has(preview.designProjectId)) continue;
    seen.add(preview.designProjectId);
    designs.push({ id: preview.designProjectId, name: preview.name, version: preview.version, passed: preview.checks?.passed ?? null });
  }
  return designs;
}

/**
 * The design a selection points at: a garment board's own, or the garment feeding a selected tech
 * pack or order board. Anything else, or nothing selected, falls back to the canvas's first design
 * that can be read, so the Order button always names the design it would order.
 */
export function designFor(graph: Graph, selectedId: string | null, designs: readonly OrderableDesign[]): OrderableDesign | null {
  const selected = graph.boards.find((board) => board.id === selectedId);
  const wanted = selected === undefined ? null : isLinkedKind(selected.kind) ? linkedDesignOf(graph, selected) : designOfBoard(selected);
  return designs.find((one) => one.id === wanted) ?? designs[0] ?? null;
}

export type OrderGate = Readonly<{ open: true }> | Readonly<{ open: false; reason: string }>;

/**
 * `08` §5.1: the Order button is "disabled with a tooltip until a Garment board validates". The
 * drawer's own sends still go through the D1 gate on the server (`lib/make/order-gate.ts`): this is
 * the early word, never the check itself.
 */
export function orderGate(design: OrderableDesign | null): OrderGate {
  if (design === null) return { open: false, reason: "Add a garment board first: an order is made from a garment." };
  if (design.passed === null) return { open: false, reason: `Run the checks on ${design.name} in the editor first.` };
  if (!design.passed) return { open: false, reason: `${design.name} has checks to fix before it can be ordered.` };
  return { open: true };
}

/** The boards the Export popover's artboard checklist lists: everything but garments and their linked boards. */
export const artboardsOf = (boards: readonly BoardView[]): readonly BoardView[] =>
  boards.filter((board) => !isGarmentKind(board.kind) && !isLinkedKind(board.kind));

/** "All artboards (5)" or "Selected artboards (2)" (`08` v3.6 Export). */
export function checklistLabel(chosen: number, total: number): string {
  if (total > 0 && chosen === total) return `All artboards (${total})`;
  return `Selected artboards (${chosen})`;
}

/** The width or height the popover shows: the one figure, or "Mix" when the chosen boards differ. */
export function sharedFigure(values: readonly number[]): string {
  const first = values[0];
  if (first === undefined) return "";
  return values.every((value) => value === first) ? String(first) : "Mix";
}

export interface GarmentOutput {
  readonly id: "techpack-pdf" | "techpack-xlsx" | "production-package";
  readonly label: string;
  readonly note: string;
  readonly href: string;
}

/** The Export popover's Garment board block: the tech pack as PDF and Excel, and the production package. */
export function garmentOutputs(design: OrderableDesign): readonly GarmentOutput[] {
  const base = `/api/projects/${encodeURIComponent(design.id)}`;
  return [
    { id: "techpack-pdf", label: "Tech pack (PDF)", note: "16 pages. Costs credits.", href: `${base}/exports/pdf?version=${design.version}` },
    { id: "techpack-xlsx", label: "Tech pack (Excel)", note: "Free.", href: `${base}/exports/xlsx?version=${design.version}` },
    {
      id: "production-package",
      label: "Production package (ZIP)",
      note: "Pre-export check first: a gap is named, never charged.",
      href: `${base}/production-package`,
    },
  ];
}

export const QUOTE_SPORTS: readonly Readonly<{ id: string; label: string }>[] = SPORTS.map((sport) => ({ id: sport.id, label: sport.label }));

const ARTICLE = /^[A-Z]{3}-[A-Z]{2}-[0-9]{2}$/;
export const QUOTE_MAX_PIECES = 99_999;

/**
 * The address of a quote PDF for this design (spec F-T5), in the form `/api/quotes` reads
 * (`lib/quotes/download.ts`, which a test holds this to). The server prices it again from the
 * factory's tiers, so the address carries only what to price. Null when the design has no catalogue
 * article or the pieces are not a count the quote takes.
 */
export function quoteLink(input: Readonly<{ sportId: string; currency: string; articleCode: string | null; pieces: number; names: boolean }>): string | null {
  if (input.articleCode === null || !ARTICLE.test(input.articleCode)) return null;
  if (!Number.isInteger(input.pieces) || input.pieces < 1 || input.pieces > QUOTE_MAX_PIECES) return null;
  const params = new URLSearchParams({ sport: input.sportId, market: input.currency });
  params.append("line", `${input.articleCode}:${input.pieces}`);
  if (input.names) params.set("names", "1");
  return `/api/quotes?${params.toString()}`;
}
