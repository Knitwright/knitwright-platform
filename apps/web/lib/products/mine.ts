import type { Route } from "next";
import type { ProductView } from "@/lib/brand-runs/service";
import { STAGE_LABELS, STAGES, type Stage } from "@/lib/brand-runs/stage";
import { MY_PRODUCTS_PATH } from "./routes";

/**
 * My products (09 screen 10, v3.5 "My products"; prototype p05): a row list over `brand_products` with status chips
 * and the sales-channel column.
 *
 * The prototype's chips (Published, Drafts, Publishing errors, Archived) are listing states, and there are no
 * listings until the sales channels arrive with workstream C1. What a product does have is its stage (idea, sample,
 * run; decision 0045's `brand_products.stage`), so those are the chips, and the channel column says plainly that no
 * channel is connected yet rather than inventing a "Not published".
 */

export const CHANNEL_NONE = "No sales channel yet";

export type StageFilter = "all" | Stage;

export const STAGE_TONES: Readonly<Record<Stage, "neutral" | "info" | "ok">> = { idea: "neutral", sample: "info", run: "ok" };

export interface StageChip {
  readonly id: StageFilter;
  readonly label: string;
  readonly count: number;
  readonly href: Route;
}

export interface ProductRow {
  readonly id: string;
  readonly name: string;
  readonly stage: Stage;
  readonly stageLabel: string;
  readonly detail: string;
  readonly updated: string;
  readonly channel: string;
  readonly editHref: Route;
  readonly runsHref: Route;
}

const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "4 Dec", as 10 §10 writes dates. */
export const shortDate = (iso: string): string => SHORT.format(new Date(iso));

const one = (value: string | readonly string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : (value as string | undefined));

export const stageFromQuery = (value: string | readonly string[] | undefined): StageFilter => {
  const asked = one(value);
  return STAGES.find((stage) => stage === asked) ?? "all";
};

const hrefFor = (stage: StageFilter, search: string): Route => {
  const query = new URLSearchParams({ ...(stage === "all" ? {} : { stage }), ...(search ? { q: search } : {}) }).toString();
  return `${MY_PRODUCTS_PATH}${query ? `?${query}` : ""}` as Route;
};

export function stageChips(products: readonly ProductView[], search: string): readonly StageChip[] {
  const all: StageChip = { id: "all", label: "All", count: products.length, href: hrefFor("all", search) };
  return [all, ...STAGES.map((stage) => ({ id: stage, label: STAGE_LABELS[stage], count: products.filter((p) => p.stage === stage).length, href: hrefFor(stage, search) }))];
}

const runsLine = (product: ProductView): string => {
  const count = product.runs.length;
  return `Version ${product.designVersion} · ${count === 0 ? "no runs yet" : `${count} run${count === 1 ? "" : "s"}`}`;
};

const toRow = (product: ProductView): ProductRow => ({
  id: product.id,
  name: product.name,
  stage: product.stage,
  stageLabel: STAGE_LABELS[product.stage],
  detail: runsLine(product),
  updated: shortDate(product.runs[0]?.createdAt ?? product.createdAt),
  channel: CHANNEL_NONE,
  editHref: `/studio/${product.projectId}` as Route,
  runsHref: "/orders/runs" as Route,
});

/** The rows for the chosen stage and search words. */
export function productRows(products: readonly ProductView[], stage: StageFilter, search: string): readonly ProductRow[] {
  const words = search.trim().toLowerCase();
  return products
    .filter((product) => stage === "all" || product.stage === stage)
    .filter((product) => words === "" || product.name.toLowerCase().includes(words))
    .map(toRow);
}
