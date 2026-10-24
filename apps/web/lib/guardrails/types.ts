import type { Point } from "@/lib/production/contract";

export type { Point };

/** An axis-aligned box in a panel's millimetres. */
export interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** The planned shape of V1's check output. Registering into V1's `CheckModule` registry waits until V1 merges. */
export type FindingCode = "seam-cross" | "min-dpi" | "bleed-short" | "safe-zone" | "gamut-approx";
export type CheckKind = "seam_cross" | "dpi" | "bleed" | "safe_zone" | "gamut";

export interface Finding {
  readonly code: FindingCode;
  readonly check: CheckKind;
  readonly severity: "blocker" | "warning";
  /** The panel the finding is on, or null for a colour, which belongs to no panel. */
  readonly panel: string | null;
  /** The item (layer) it is about. */
  readonly itemId: string | null;
  /** Where on the panel, in millimetres, or null when there is no place. */
  readonly locationMm: { readonly x: number; readonly y: number } | null;
  readonly message: string;
  readonly fix: string;
}

/** A panel as the checks see it, taken from a pattern piece of the production contract. */
export interface Panel {
  readonly id: string;
  readonly cutOutline: readonly Point[];
  /** The sewn edge. When null the cut outline stands in and the messages say so. */
  readonly sewLine: readonly Point[] | null;
  /** Lines where this panel is mirrored onto its partner (a centre seam), as pairs of points. */
  readonly mirrorLines: readonly (readonly [Point, Point])[];
}

export type ItemKind = "raster" | "vector" | "name" | "number" | "text" | "fill";

/** One placed thing, in its panel's millimetres. Marks are `name` or `number`; `fill` covers the panel (a pattern or ground). */
export interface PlacedItem {
  readonly id: string;
  readonly label: string;
  readonly kind: ItemKind;
  readonly panelId: string;
  readonly box: Box;
  /** Pixels across, for a raster. */
  readonly widthPx?: number;
}

export interface UsedColour {
  readonly id: string;
  readonly label: string;
  /** `#rrggbb` screen colour. */
  readonly hex: string;
}

export interface Setting<T> {
  readonly value: T;
  /** Where it came from: the print house's own, or the default label. */
  readonly source: "print-house" | "knitwright-default";
}

export interface GuardrailSettings {
  readonly minDpi: Setting<number>;
  readonly bleedMm: Setting<number>;
  readonly safeZoneMm: Setting<number>;
}

export interface GuardrailInput {
  readonly panels: readonly Panel[];
  readonly items: readonly PlacedItem[];
  readonly colours: readonly UsedColour[];
  readonly settings: GuardrailSettings;
}
