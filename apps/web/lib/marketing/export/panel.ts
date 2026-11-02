import { MAX_ARTBOARD_PX, MIN_ARTBOARD_PX, printSize, readSize, type ArtboardUnit, type Size } from "@/lib/launch";
import {
  EXPORT_RULE,
  IS_VECTOR,
  KEEPS_TRANSPARENCY,
  MAX_EXPORT_PIXELS,
  NO_PROFILE_NOTE,
  type ColourSpace,
  type ExportTarget,
  type FileFormat,
  type WatermarkRule,
} from "./targets";

/**
 * THE EXPORT PANEL'S OWN CHOICES (spec F-L2 "Export"; plan v5 L4, decision 0094).
 *
 * The panel's rules, kept apart from the screen, as the tech pack's export panel does
 * (`lib/techpack/exports/panel.ts`). Nothing here reads the database and nothing here writes a
 * file: `service.ts` reads the rows and `render.ts` makes the bytes, so opening the panel pulls
 * neither into the page.
 *
 * The one principle: **a target that cannot be met is refused with a sentence that says what to do,
 * never exported as something else.** A CMYK file with no colour profile, a JPEG asked to keep
 * transparency, a 300 dpi file on a plan that stops at 72, a size the canvas cannot draw: each is a
 * refusal in words, not a file that looks right and is wrong.
 */

/** One artboard the panel may export, from the shell's own boards. */
export interface ExportBoard {
  readonly id: string;
  readonly name: string;
  readonly size: Size;
}

export interface ExportRequest {
  /** The boards chosen: one is "this board", more is the spec's "Selected artboards (n)". */
  readonly boards: readonly ExportBoard[];
  /** The width and height typed into the fields, in `unit`. */
  readonly width: number;
  readonly height: number;
  readonly unit: ArtboardUnit;
  readonly dpi: number;
  readonly format: FileFormat;
  readonly colourSpace: ColourSpace;
  readonly removeBackground: boolean;
  /** The watermark rule of the plan this brand is on, or null when no row covers it. */
  readonly rule: WatermarkRule | null;
  /** True when a colour profile for the press is on file. None is today, so CMYK is refused. */
  readonly cmykProfile: boolean;
}

export interface ExportPlan {
  /** The pixels each file is made at. A vector file carries it as the page's own size. */
  readonly size: Size;
  /** The live print size the panel shows under the fields, such as "210.0 mm × 297.0 mm". */
  readonly printSize: string;
  readonly format: FileFormat;
  readonly colourSpace: ColourSpace;
  readonly dpi: number;
  /** True when the platform's existing preview mark goes over every file (spec: free plan). */
  readonly watermark: boolean;
  /** One file per board; more than one is sent as a zip (spec F-L2). */
  readonly fileNames: readonly string[];
  readonly zip: boolean;
  /** False for a file made of shapes and text, where the size is the page's and not a count of pixels. */
  readonly rasterised: boolean;
}

export type ExportVerdict = Readonly<{ ok: true; plan: ExportPlan }> | Readonly<{ ok: false; reason: string; ruleId: string }>;

const refuse = (reason: string): ExportVerdict => ({ ok: false, reason, ruleId: EXPORT_RULE });

const EXTENSION: Readonly<Record<FileFormat, string>> = { png: "png", jpeg: "jpg", svg: "svg", pdf: "pdf" };

const NOT_SAFE = /[^a-z0-9]+/g;

/**
 * A file name from a board's name: lower case, letters and digits, hyphens between. Short, because
 * a zip of several boards is read by a person looking for one of them. The tech pack's own file
 * names (`lib/techpack/exports/file-names.ts`) are built from a style number and a version, which a
 * launch board has neither of, so this is its own small rule rather than a worse fit for that one.
 */
export function exportFileName(name: string, format: FileFormat, index: number): string {
  const safe = name.toLowerCase().replace(NOT_SAFE, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, "");
  const stem = safe === "" ? `artboard-${index + 1}` : safe;
  return `${stem}.${EXTENSION[format]}`;
}

/** Every file name a request would produce, each one its own even when two boards share a name. */
function fileNames(request: ExportRequest): readonly string[] {
  const used = new Map<string, number>();
  return request.boards.map((board, index) => {
    const wanted = exportFileName(board.name, request.format, index);
    const seen = used.get(wanted) ?? 0;
    used.set(wanted, seen + 1);
    return seen === 0 ? wanted : wanted.replace(/\.([a-z]+)$/, `-${seen + 1}.$1`);
  });
}

/** The pixels a width and a height in a unit mean, or the refusal L1's own bounds give. */
function sizeFor(request: ExportRequest): ExportVerdict | Size {
  const verdict = readSize(request.width, request.height, request.unit, request.dpi);
  if (!verdict.ok) return refuse(verdict.reason);
  const pixels = verdict.size.width * verdict.size.height;
  if (pixels > MAX_EXPORT_PIXELS) {
    const megapixels = Math.floor(MAX_EXPORT_PIXELS / 1_000_000);
    return refuse(`That is ${Math.round(pixels / 1_000_000)} megapixels, and one file goes up to ${megapixels}. Lower the resolution or the size.`);
  }
  return verdict.size;
}

/** Why a colour space, a format or a plan cannot give what was asked for, or null when they can. */
function sayNo(request: ExportRequest): string | null {
  if (request.colourSpace === "cmyk" && !request.cmykProfile) {
    return `${NO_PROFILE_NOTE} Export it as RGB, or ask us to put a profile on file.`;
  }
  if (request.colourSpace === "cmyk" && request.format !== "jpeg" && request.format !== "pdf") {
    return "A CMYK file is a JPEG or a PDF. Choose one of those, or export this as RGB.";
  }
  if (request.removeBackground && !KEEPS_TRANSPARENCY[request.format]) {
    return "A JPEG has no transparency, so the background would come back as white. Choose PNG, or keep the background.";
  }
  if (request.rule && request.dpi > request.rule.maxDpi) {
    return `${request.rule.label} exports go up to ${request.rule.maxDpi} dots per inch. Choose ${request.rule.maxDpi}, or unlock this export.`;
  }
  if (request.boards.length === 0) return "Pick at least one artboard to export.";
  return null;
}

/**
 * What the panel would produce, or why it would not. Every number in it comes from the request and
 * the rows: this function invents no size, no resolution and no colour space.
 */
export function exportVerdict(request: ExportRequest): ExportVerdict {
  const no = sayNo(request);
  if (no) return refuse(no);
  const size = sizeFor(request);
  if ("ok" in size) return size;
  return {
    ok: true,
    plan: {
      size,
      printSize: printSize(size, request.unit, request.dpi),
      format: request.format,
      colourSpace: request.colourSpace,
      dpi: request.dpi,
      watermark: request.rule?.watermarked ?? false,
      fileNames: fileNames(request),
      zip: request.boards.length > 1,
      rasterised: !IS_VECTOR[request.format],
    },
  };
}

/**
 * The quick export (spec F-L2: "PNG at 1x / 2x / 3x"). The artboard's own pixels times the
 * target's scale, with nothing typed in, so one press is one file.
 */
export function quickVerdict(target: ExportTarget, board: ExportBoard, rule: WatermarkRule | null): ExportVerdict {
  const size = { width: Math.round(board.size.width * target.scale), height: Math.round(board.size.height * target.scale) };
  if (size.width > MAX_ARTBOARD_PX || size.height > MAX_ARTBOARD_PX) {
    return refuse(`${target.label} of this artboard would be wider than ${MAX_ARTBOARD_PX} px. Use 1x, or export it at a size you type in.`);
  }
  if (size.width < MIN_ARTBOARD_PX || size.height < MIN_ARTBOARD_PX) return refuse(`The smallest file is ${MIN_ARTBOARD_PX} px.`);
  return exportVerdict({
    boards: [board],
    width: size.width,
    height: size.height,
    unit: "px",
    dpi: target.dpi,
    format: target.format,
    colourSpace: target.colourSpace,
    removeBackground: false,
    rule,
    cmykProfile: false,
  });
}
