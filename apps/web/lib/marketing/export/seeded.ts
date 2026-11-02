import { MARKETING_RULE } from "../rules";
import type { ExportTarget, WatermarkRule } from "./targets";

/**
 * THE SEEDED ROWS, WRITTEN OUT A SECOND TIME (plan v5 L4, decision 0094).
 *
 * `marketing_export_targets` and `marketing_watermark_rules` are the authority: a platform admin
 * changes a row and the panel changes with it. But a panel is handed only `LaunchPanelProps` -- the
 * project, the selection and the commands -- and a panel never fetches, so until the shell carries
 * these rows a panel needs the same figures in code.
 *
 * So they are here, and `seeded.test.ts` **reads the migration's own INSERT statements and holds
 * these two lists to them**. Two copies of one table is the cost; the test is what makes it safe,
 * and it is the same bargain L1 struck with the board table (decision 0091, point 3).
 *
 * Nothing here is a figure of its own: every number and every note is the row's.
 */

const target = (
  key: string,
  label: string,
  lead: string,
  format: ExportTarget["format"],
  colourSpace: ExportTarget["colourSpace"],
  dpi: number,
  scale: number,
  quick: boolean,
  sort: number,
  note: string,
): ExportTarget => ({ key, label, lead, format, colourSpace, dpi, scale, quick, sort, ruleId: MARKETING_RULE, note });

const QUICK_NOTE = "The spec's quick export; nobody has reviewed these sizes";
const PLACEHOLDER = "Placeholder resolution, not reviewed by anyone";

export const SEEDED_EXPORT_TARGETS: readonly ExportTarget[] = [
  target("png-1x", "PNG 1x", "The artboard at its own size, for a screen.", "png", "rgb", 72, 1, true, 10, QUICK_NOTE),
  target("png-2x", "PNG 2x", "Twice the artboard's size, for a sharper screen.", "png", "rgb", 72, 2, true, 20, QUICK_NOTE),
  target("png-3x", "PNG 3x", "Three times the artboard's size.", "png", "rgb", 72, 3, true, 30, QUICK_NOTE),
  target("png-print", "PNG for print", "The artboard at 300 dots per inch, as a PNG.", "png", "rgb", 300, 1, false, 40, PLACEHOLDER),
  target("jpeg-screen", "JPEG", "A smaller file for a screen, with no transparency.", "jpeg", "rgb", 72, 1, false, 50, PLACEHOLDER),
  target("svg-vector", "SVG", "The layout as shapes and text, which stays sharp at any size.", "svg", "rgb", 72, 1, false, 60, PLACEHOLDER),
  target("pdf-print", "PDF for print", "A page at 300 dots per inch, for a printer.", "pdf", "rgb", 300, 1, false, 70, PLACEHOLDER),
  target(
    "pdf-print-cmyk",
    "PDF for print (CMYK)",
    "The same page separated for a press, once a colour profile is on file.",
    "pdf",
    "cmyk",
    300,
    1,
    false,
    80,
    "No colour profile is on file, so this target is refused and says why",
  ),
];

const SPEC_SENTENCE = "The spec's sentence; the resolution is a placeholder, not reviewed by anyone";

export const SEEDED_WATERMARK_RULES: readonly WatermarkRule[] = [
  { plan: "free", label: "Free plan", watermarked: true, maxDpi: 72, ruleId: MARKETING_RULE, note: SPEC_SENTENCE },
  { plan: "paid", label: "Paid plan", watermarked: false, maxDpi: 300, ruleId: MARKETING_RULE, note: SPEC_SENTENCE },
];
