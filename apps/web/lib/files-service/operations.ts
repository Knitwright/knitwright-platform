/**
 * What the future Python files service does, as one list (decision 0070, owner decision 2 of
 * plan v5). The service is the Sportswear model behind FastAPI; it is NOT wired in. Nothing in
 * the platform calls it yet except a health check, and every operation here answers
 * "not available" while `FILES_SERVICE_URL` is unset.
 *
 * Deterministic file generation stays in TypeScript: DXF, SVG, PDF, CSV and ZIP are made by
 * `lib/kpp`, `lib/pattern-library` and `lib/print`, and are not listed here.
 */

export const FILES_SERVICE_OPERATIONS = [
  /** Draft a base article's panels from body measurements and parameters. */
  "draft_pattern",
  /** Read a DXF a factory or pattern master sent and return its pieces. */
  "read_dxf",
  /** Grain-constrained nest and marker for a fabric width, with shrinkage, nap and costing. */
  "nest_marker",
  /** Check a size's panels against an avatar and report where it pulls or gapes. */
  "fit_check",
  /** A render of the garment locked to its geometry: ghost mannequin or on a model. */
  "render_garment",
  /** Put a design or a fabric texture onto an existing render. */
  "transfer_design",
  /** Composite a brand's logo onto an existing render. */
  "composite_logo",
  /** Look for brand marks and trademark text in an image (F-G1). */
  "detect_brand_marks",
] as const;

export type FilesServiceOperation = (typeof FILES_SERVICE_OPERATIONS)[number];

/**
 * The operations that call a commercial model and therefore cost money. Every one of these goes
 * through `lib/usage` metering before the call and is refunded when the call fails
 * (`lib/files-service/metered.ts`). The others are compute on our own service.
 */
export const PAID_OPERATIONS: readonly FilesServiceOperation[] = [
  "render_garment",
  "transfer_design",
  "composite_logo",
  "detect_brand_marks",
];

export const isPaid = (operation: FilesServiceOperation): boolean => PAID_OPERATIONS.includes(operation);

/**
 * Which Sportswear engine each operation will come from, and what stops it being used.
 * `Sportswear/` is never read or built here; this table is the contract's side of the seam and is
 * copied into decision 0070. A licence note of "none yet" means the engine has not been picked.
 */
export const ENGINE_NOTES: Readonly<Record<FilesServiceOperation, Readonly<{ engine: string; licence: string }>>> = {
  draft_pattern: { engine: "Sportswear parametric drafter (body measurements to panels)", licence: "Knitwright's own code; no third-party weights." },
  read_dxf: { engine: "Sportswear DXF reader (ezdxf with the AAMA/ASTM add-on)", licence: "ezdxf is MIT." },
  nest_marker: { engine: "Sportswear nesting and marker maker (grain constrained, fabric width, shrinkage, one-way nap, per-kg and per-metre costing)", licence: "Knitwright's own code; no third-party weights." },
  fit_check: { engine: "Sportswear avatar fit check", licence: "Knitwright's own code; no third-party weights." },
  render_garment: { engine: "Sportswear ghost-mannequin and on-model renderer", licence: "NOT klein-9b: its weights are under a non-commercial waiver and must not be used commercially. A commercial-licence provider has to be chosen first." },
  transfer_design: { engine: "Sportswear design and fabric texture transfer", licence: "NOT SegFormer: it must not be used commercially. Any segmentation step needs a commercially licensed model." },
  composite_logo: { engine: "Sportswear logo compositor", licence: "NOT SegFormer, for the same reason; a commercially licensed segmenter is needed for the garment mask." },
  detect_brand_marks: { engine: "Sportswear brand-mark detector", licence: "Vision model to be chosen; commercial-licence tier only (docs/spec/05-architecture.md)." },
};
