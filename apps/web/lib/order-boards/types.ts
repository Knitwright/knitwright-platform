import type { GarmentPreview } from "@/lib/canvas/types";

/**
 * What the Tech pack and Order boards of the one canvas show (plan v6 E4, decision 0148). Read on the
 * server by `server.ts`, handed to the canvas through `OrderBoardsProvider`, and plain data all the
 * way, so the page can send it to the browser.
 */

export type StepState = "done" | "current" | "todo";

export interface TrackStepView {
  readonly id: string;
  readonly label: string;
  readonly state: StepState;
}

/** A tech pack board's summary of its design's tech pack: the sixteen pages and what waits for input. */
export interface TechPackSummary {
  readonly designProjectId: string;
  readonly designName: string;
  /** The design's current version: the board is live-linked, as the garment board is. */
  readonly version: number;
  readonly pages: number;
  /** The page titles the board draws as thumbnails, in the specification's order. */
  readonly thumbnails: readonly Readonly<{ number: number; title: string }>[];
  readonly needsInput: number;
  readonly fromBase: number;
  readonly fromDesign: number;
  /** True while the Review tab holds the export back (spec F-S6). */
  readonly exportBlocked: boolean;
  /** The Review tab's own line, such as "3 fields are waiting for you; 1 check stops the export." */
  readonly reviewNote: string;
}

/** The newest order of a design, as its Order board shows it. */
export interface OrderStateSummary {
  readonly orderId: string;
  readonly number: string;
  /** "Sample order", "Run" or "Order". */
  readonly title: string;
  /** "3 pieces · £117.00 · ready 18 Nov". */
  readonly line: string;
  readonly sizes: string;
  readonly status: string;
  readonly tone: "ok" | "warn" | "bad" | "info" | "neutral";
  readonly steps: readonly TrackStepView[];
  /** The order's own page in Orders, where its tracking is. */
  readonly trackingHref: string;
}

/** A design the canvas can order, export or share: a garment board's design. */
export interface OrderableDesign {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  /** The last validation of this version: true passed, false failed, null never run. */
  readonly passed: boolean | null;
}

export interface OrderBoardsData {
  readonly brandName: string;
  /** Whether this member may order (owners, admins and kit managers). */
  readonly canOrder: boolean;
  readonly techPacks: Readonly<Record<string, TechPackSummary | null>>;
  readonly orders: Readonly<Record<string, OrderStateSummary | null>>;
  /** What every garment board shows, by design id (`lib/canvas/server.ts`): which design the panels act on. */
  readonly garments: Readonly<Record<string, GarmentPreview | null>>;
}

export const NO_ORDER_BOARDS: OrderBoardsData = { brandName: "", canOrder: false, techPacks: {}, orders: {}, garments: {} };

/** The three project panels: Share, Export and Order (`components/order-boards/OrderBoardsContext.tsx`). */
export const PROJECT_PANELS = ["share", "export", "order"] as const;
export type ProjectPanelId = (typeof PROJECT_PANELS)[number];
