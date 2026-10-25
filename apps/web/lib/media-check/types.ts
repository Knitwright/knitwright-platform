import type { Thresholds } from "./settings";

/** A rectangle on the reference canvas, in reference pixels. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A mark that must come through unchanged: a crest, a sponsor, a name or a number. */
export interface ProtectedRegion extends Rect {
  readonly id: string;
  readonly kind: "crest" | "sponsor" | "name" | "number";
}

/** One panel of the garment (for example a body or a sleeve). Colour and structure are measured per panel. */
export interface PanelRegion extends Rect {
  readonly id: string;
}

export type CheckName = "input" | "alignment" | "colour" | "structure" | "protected";

export type FindingCode =
  | "unreadable_generated"
  | "canvas_mismatch"
  | "not_aligned"
  | "colour_changed"
  | "structure_moved"
  | "protected_missing"
  | "protected_warped"
  | "protected_colour_changed";

/** One reason a picture was turned away, with the number measured and the limit it was held to. */
export interface Finding {
  readonly code: FindingCode;
  readonly check: CheckName;
  readonly message: string;
  readonly measured: number;
  readonly threshold: number;
  readonly regionId?: string;
}

/** One number the checker measured, whether or not it caused a rejection. */
export interface Measurement {
  readonly check: CheckName;
  readonly regionId?: string;
  readonly measured: number | null;
  readonly threshold: number;
  readonly status: "ok" | "failed" | "skipped";
}

export interface CheckReport {
  readonly verdict: "passed" | "rejected";
  readonly findings: readonly Finding[];
  /** The checks that produced a finding, in a fixed order, so a retry can aim at them. */
  readonly failedChecks: readonly CheckName[];
  readonly measurements: readonly Measurement[];
  readonly thresholdsNote: string;
}

export interface CheckInput {
  /** PNG of the deterministic render; its alpha channel is the garment mask. */
  readonly reference: Uint8Array;
  /** The generated picture, on the same canvas as the reference. */
  readonly generated: Uint8Array;
  readonly protectedRegions: readonly ProtectedRegion[];
  /** Panels for the per-panel colour and structure checks. Omitted: the whole garment is one panel. */
  readonly panels?: readonly PanelRegion[];
  /** Overrides for the default thresholds. */
  readonly thresholds?: Partial<Thresholds>;
}
