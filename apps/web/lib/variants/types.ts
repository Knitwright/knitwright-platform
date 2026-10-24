import type { GarmentSpec, SpecAction } from "@/lib/garment";

export type VariantKind = "colourway" | "kit-style" | "placement";

/** A finding about a candidate, in the shape the panel shows. */
export interface VariantFinding {
  readonly code: string;
  readonly severity: "blocker" | "warning";
  readonly panel: string | null;
  readonly message: string;
}

/** One alternative: the changes that make it, the design they give, and the warnings it still carries. */
export interface Variant {
  /** Stable for the same changes, so the same variant keeps its id between visits. */
  readonly id: string;
  readonly kind: VariantKind;
  readonly label: string;
  readonly summary: string;
  readonly actions: readonly SpecAction[];
  readonly spec: GarmentSpec;
  readonly warnings: readonly VariantFinding[];
}

/** The validation gate for one design: its findings. Run on the design and on every candidate. */
export type VariantGate = (spec: GarmentSpec) => readonly VariantFinding[];

export interface GenerateOptions {
  /** 8 to 12; anything else is brought into range. */
  readonly count: number;
  readonly seed: number;
  readonly gate?: VariantGate;
}

export const MIN_VARIANTS = 8;
export const MAX_VARIANTS = 12;
