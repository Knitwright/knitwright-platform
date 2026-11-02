import { MARKETING_RULE } from "../rules";

/**
 * WHAT THE EXPORT PANEL OFFERS (spec F-L2 "Export"; plan v5 L4, decision 0094).
 *
 * The formats, the resolutions and the colour spaces are **rows**, not numbers in this file:
 * `marketing_export_targets` holds them, and `service.ts` reads them. What is here is the
 * vocabulary those rows are written in, the types the panel uses, and the plain words for each --
 * none of which is a decision somebody could want to change without a deployment.
 *
 * No zod here, so a panel can import the labels without shipping a schema library to the browser
 * (`tests/architecture/client-weight.test.ts`).
 */

export const FILE_FORMATS = ["png", "jpeg", "svg", "pdf"] as const;
export type FileFormat = (typeof FILE_FORMATS)[number];

export const FORMAT_LABELS: Readonly<Record<FileFormat, string>> = { png: "PNG", jpeg: "JPEG", svg: "SVG", pdf: "PDF" };

/** The formats that keep transparency. A JPEG and a separated PDF do not. */
export const KEEPS_TRANSPARENCY: Readonly<Record<FileFormat, boolean>> = { png: true, jpeg: false, svg: true, pdf: true };

/** The formats made of shapes and text rather than pixels, so a resolution does not change them. */
export const IS_VECTOR: Readonly<Record<FileFormat, boolean>> = { png: false, jpeg: false, svg: true, pdf: true };

export const COLOUR_SPACES = ["rgb", "cmyk"] as const;
export type ColourSpace = (typeof COLOUR_SPACES)[number];

export const COLOUR_SPACE_LABELS: Readonly<Record<ColourSpace, string>> = { rgb: "RGB (web)", cmyk: "CMYK (print)" };

/** One target the panel offers, from a row of `marketing_export_targets`. */
export interface ExportTarget {
  readonly key: string;
  readonly label: string;
  readonly lead: string;
  readonly format: FileFormat;
  readonly colourSpace: ColourSpace;
  /** The dots per inch this target is read at. */
  readonly dpi: number;
  /** How many times the artboard's own pixel size, for the quick export's 1x, 2x and 3x. */
  readonly scale: number;
  /** True for a target the quick export shows as one button. */
  readonly quick: boolean;
  readonly sort: number;
  readonly ruleId: string;
  /** Where the figures came from. Every seeded row says nobody reviewed them. */
  readonly note: string;
}

/** The watermark rule of one plan, from a row of `marketing_watermark_rules`. */
export interface WatermarkRule {
  readonly plan: "free" | "paid";
  readonly label: string;
  readonly watermarked: boolean;
  readonly maxDpi: number;
  readonly ruleId: string;
  readonly note: string;
}

/**
 * The most pixels one exported file may be, because a file nobody can open is not an export. At
 * 24 bits a pixel this is about 360 MB in memory while it is being written. Knitwright's own
 * figure, in `MARKETING_GAPS`; the panel says it rather than failing halfway through.
 */
export const MAX_EXPORT_PIXELS = 120_000_000;

/** The quick export's buttons, in the order the rows give. */
export const quickTargets = (targets: readonly ExportTarget[]): readonly ExportTarget[] => targets.filter((one) => one.quick);

/** The full export's targets: everything that is not a one-click quick export. */
export const fullTargets = (targets: readonly ExportTarget[]): readonly ExportTarget[] => targets.filter((one) => !one.quick);

export const targetByKey = (targets: readonly ExportTarget[], key: string): ExportTarget | null =>
  targets.find((one) => one.key === key) ?? null;

/** The rule for a plan, or null when no row covers it. Nothing is assumed about a plan with no row. */
export const ruleForPlan = (rules: readonly WatermarkRule[], plan: WatermarkRule["plan"]): WatermarkRule | null =>
  rules.find((one) => one.plan === plan) ?? null;

/** The formats the rows offer, in the vocabulary's own order, for a list of choices. */
export const formatsOffered = (targets: readonly ExportTarget[]): readonly FileFormat[] =>
  FILE_FORMATS.filter((format) => targets.some((one) => one.format === format));

/** The resolutions the rows offer, smallest first. The spec's panel has two: 72 and 300. */
export const dpiOffered = (targets: readonly ExportTarget[]): readonly number[] =>
  [...new Set(targets.map((one) => one.dpi))].sort((a, b) => a - b);

/** Said against a target whose rows name a colour space the platform cannot honour yet. */
export const NO_PROFILE_NOTE = "No colour profile is on file, so this file cannot be separated for a press.";

/** The rule id every refusal of this directory carries while no rulebook entry covers marketing artwork. */
export const EXPORT_RULE = MARKETING_RULE;
