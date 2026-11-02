import { effectiveDpi, largestWidthMm } from "@/lib/artwork-intake/dpi";
import { DEFAULT_MIN_DPI } from "@/lib/artwork-intake/settings";
import { sniffArtwork } from "@/lib/artwork-intake/sniff";
import { CREST_LIMITS, RULES } from "./settings";

/**
 * The crest itself (spec F-T2 steps 1 and 2) and the vectorise check.
 *
 * THE CREST IS NEVER ALTERED. Every kit this workstream proposes carries the very bytes the club
 * uploaded: nothing here resizes, recolours, traces, crops or re-encodes them. The crest's colours
 * are read from a decoded COPY (`palette.ts`), and the bytes themselves are passed through by
 * reference, so `crest.test.ts` can hash them before and after the whole run and get the same
 * digest. That is the spec's "the crest is placed unaltered", and it is why the engine's output
 * holds a `CrestFile` and never a picture it made.
 *
 * "Vectorised" here means: a drawing stays sharp at any size, so it needs no check; a picture made
 * of pixels is measured against the print quality the rulebook asks for (R-SUB-003, 150 DPI at
 * 1:1) at the width it will be printed, and is FLAGGED, never silently accepted and never
 * redrawn. Knitwright does not trace a raster crest into vectors: an automatic trace changes the
 * artwork, which this file exists to prevent. The club is told what to send instead.
 */

/** The file formats spec F-T2 step 1 takes. A TIFF is not offered here, though intake accepts one. */
export const CREST_FORMATS = ["png", "jpeg", "svg", "pdf"] as const;
export type CrestFormat = (typeof CREST_FORMATS)[number];

/** What the file-input's `accept` attribute offers, and the hint beside it. */
export const CREST_ACCEPT = "image/png,image/jpeg,image/svg+xml,application/pdf,.svg";
export const CREST_FORMATS_HINT = "PNG, JPEG, SVG or PDF, up to 10 MB. An SVG or a PDF stays sharp at any size.";

/** A drawing prints sharp at any size; a picture made of pixels has a fixed number of them. */
export type CrestKind = "vector" | "raster";

export const KIND_OF: Readonly<Record<CrestFormat, CrestKind>> = { png: "raster", jpeg: "raster", svg: "vector", pdf: "vector" };

/**
 * One uploaded crest. `bytes` is the file exactly as it arrived and is never written to: it is the
 * value every kit carries, and the byte-for-byte test reads it back out of a finished kit.
 */
export interface CrestFile {
  readonly name: string;
  readonly format: CrestFormat;
  readonly kind: CrestKind;
  readonly bytes: Uint8Array;
  /** The pixel width of a raster crest, or null for a drawing, which has none. */
  readonly widthPx: number | null;
  readonly heightPx: number | null;
}

export type CrestRefusal = "too-big" | "empty" | "not-accepted";

/** Why a file was refused, in plain words with what to do about it. Nothing was kept. */
export const CREST_REFUSALS: Readonly<Record<CrestRefusal, string>> = {
  "too-big": "That file is over 10 MB. Save a smaller copy of your crest, or export it as an SVG, which is usually tiny.",
  empty: "That file is empty. Choose the file again, or export your crest afresh.",
  "not-accepted": "Knitwright reads a crest as a PNG, a JPEG, an SVG or a PDF. Export yours as one of those and try again.",
};

export type CrestRead = Readonly<{ ok: true; crest: CrestFile }> | Readonly<{ ok: false; reason: CrestRefusal; message: string }>;

const refuse = (reason: CrestRefusal): CrestRead => ({ ok: false, reason, message: CREST_REFUSALS[reason] });

/** The pixel size of a raster crest, measured by the caller's decoder. A drawing has none. */
export interface CrestSize {
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * The crest of an uploaded file, or the reason it was refused. The format is read from the first
 * bytes, never from the file's name or its stated type, exactly as artwork intake reads one.
 * The bytes are kept as they came.
 */
export function readCrest(name: string, bytes: Uint8Array, size: CrestSize | null = null): CrestRead {
  if (bytes.byteLength === 0) return refuse("empty");
  if (bytes.byteLength > CREST_LIMITS.maxFileBytes) return refuse("too-big");
  const sniffed = sniffArtwork(bytes);
  const format = CREST_FORMATS.find((one) => one === sniffed);
  if (format === undefined) return refuse("not-accepted");
  const kind = KIND_OF[format];
  return {
    ok: true,
    crest: {
      name,
      format,
      kind,
      bytes,
      widthPx: kind === "raster" ? (size?.widthPx ?? null) : null,
      heightPx: kind === "raster" ? (size?.heightPx ?? null) : null,
    },
  };
}

/** What the vectorise check found. Never a blocker: a soft crest is the club's decision to make. */
export interface VectoriseCheck {
  /** True when the file is a drawing, which needs no check at all. */
  readonly vector: boolean;
  /** True when a raster crest meets the print quality the rulebook asks for at this width. */
  readonly sharpEnough: boolean;
  /** The dots per inch the file gives at `widthMm`, rounded, or null when it cannot be worked out. */
  readonly dpi: number | null;
  /** The widest print, in millimetres, at which the file still meets `minDpi`. Null for a drawing. */
  readonly largestWidthMm: number | null;
  /** What the club reads. Always a full sentence, and it always says what to do. */
  readonly message: string;
  readonly ruleId: string;
}

/**
 * How wide a crest is printed on a shirt. Knitwright's own default, not a factory's figure and not
 * a league's rule: the rulebook gives no crest size, so this is the figure the dpi check measures
 * against and the pull request asks the owner for the real one.
 */
export const CREST_WIDTH_MM = 80;

/**
 * Whether a crest prints sharp, measured with the same arithmetic the editor's own dpi guardrail
 * uses (`lib/artwork-intake/dpi`), at the width a crest is printed, against the minimum dots per
 * inch of rule R-SUB-003. A drawing is sharp at any size and says so.
 *
 * A raster crest under the minimum is FLAGGED and still offered: the spec says "raster under print
 * quality is flagged", not refused. Knitwright never traces it into vectors — that would change
 * the club's artwork.
 */
export function vectoriseCheck(crest: CrestFile, widthMm: number = CREST_WIDTH_MM, minDpi: number = DEFAULT_MIN_DPI): VectoriseCheck {
  if (crest.kind === "vector") {
    return {
      vector: true,
      sharpEnough: true,
      dpi: null,
      largestWidthMm: null,
      message: `Your crest is a drawing, so it prints sharp at any size. It is used exactly as you sent it.`,
      ruleId: RULES.printQuality,
    };
  }
  if (crest.widthPx === null || crest.widthPx <= 0) {
    return {
      vector: false,
      sharpEnough: false,
      dpi: null,
      largestWidthMm: null,
      message:
        "The size of that picture could not be read, so Knitwright cannot say whether it prints sharp. Send an SVG or a PDF of the crest, which stays sharp at any size.",
      ruleId: RULES.printQuality,
    };
  }
  const dpi = Math.round(effectiveDpi({ widthPx: crest.widthPx }, widthMm));
  const largest = Math.round(largestWidthMm({ widthPx: crest.widthPx }, minDpi));
  if (dpi >= minDpi) {
    return {
      vector: false,
      sharpEnough: true,
      dpi,
      largestWidthMm: largest,
      message: `At ${widthMm} mm wide your crest prints at about ${dpi} dots per inch, which meets the ${minDpi} the print rules ask for.`,
      ruleId: RULES.printQuality,
    };
  }
  return {
    vector: false,
    sharpEnough: false,
    dpi,
    largestWidthMm: largest,
    message: `At ${widthMm} mm wide your crest prints at about ${dpi} dots per inch, under the ${minDpi} the print rules ask for, so it may look soft on fabric. Send a larger picture, or an SVG or PDF of the crest. Your picture is big enough up to about ${largest} mm wide. Knitwright does not redraw a crest: that would change your artwork.`,
    ruleId: RULES.printQuality,
  };
}

/**
 * The bytes of a crest, for a test to hash. It hands back the very array the crest holds, so a
 * copy taken before the run and this one are equal byte for byte, or the crest was altered.
 */
export const crestBytes = (crest: CrestFile): Uint8Array => crest.bytes;

/** A plain digest of a crest's bytes, so a test can say "unaltered" in one comparison. */
export function crestDigest(crest: CrestFile): string {
  let hash = 0x811c_9dc5;
  for (const byte of crest.bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x0100_0193) >>> 0;
  }
  return `${crest.bytes.byteLength}:${hash.toString(16).padStart(8, "0")}`;
}
