import { resolveColour, type ArtworkStack, type AssetReader, type PatternGenerator, type ViewId } from "@/lib/artwork-stack";
import type { PrintProfile, PrintRuleSet } from "@/lib/production/contract";
import type { ZoneTemplate } from "../zones";
import type { Font } from "../text/font";
import type { LayoutMapper } from "./mapper";
import type { PlayerTag } from "./scene";
import type { ShrinkScale } from "./print-space";

/** The Knitwright defaults, labelled as such wherever they are shown (open items P5, P14). */
export const DEFAULT_BLEED_MM = 15;
export const DEFAULT_DPI = 150;
export const DEFAULT_LABEL = "Knitwright default, not from your print house";

/** A profile as the layout uses it: the contract's, the lowest resolution the print house accepts, and the ICC file's bytes when there is one. */
export interface PrintSettings extends PrintProfile {
  readonly minDpi: number;
  readonly iccBytes: Uint8Array | null;
  /** The profile's own name, read from the file, for the margin. */
  readonly iccName: string | null;
}

export const DEFAULT_SETTINGS: PrintSettings = Object.freeze({
  bleedMm: DEFAULT_BLEED_MM,
  dpi: DEFAULT_DPI,
  minDpi: DEFAULT_DPI,
  iccFileId: null,
  maxPrintWidthMm: null,
  source: "knitwright-default",
  iccBytes: null,
  iccName: null,
});

/** Everything a piece's artwork is built from. Pure data and interfaces: no database, no clock. */
export interface BuildEnv {
  readonly stack: ArtworkStack;
  readonly colourwayId: string;
  readonly mapper: LayoutMapper;
  readonly zoneTemplates: readonly ZoneTemplate[];
  readonly generators: readonly PatternGenerator[];
  readonly assets: AssetReader;
  readonly settings: PrintSettings;
  readonly rules: PrintRuleSet;
  /** The shrink scale and the sentence for the margin when there is none. */
  readonly scale: ShrinkScale & { readonly note: string | null };
  readonly font: Font;
  /** True once a technician has reviewed the pattern. Until then every file says it is a draft (open item P1). */
  readonly patternReviewed: boolean;
  /** Names the fabric test the scale came from, for the margin. */
  readonly scaleSource: string | null;
}

export interface PieceRequest {
  readonly view: ViewId;
  /** The pattern size to cut and print. */
  readonly size: string;
  readonly sizeLabel?: string;
  readonly player?: PlayerTag;
  /** Only the name and number, on no ground (the transfer set). */
  readonly transferOnly?: boolean;
}

export const FALLBACK_INK = "#000000";

/** The screen colour of a stack colour in the chosen colourway, or null when it has none. */
export function screenColour(env: Pick<BuildEnv, "stack" | "colourwayId">, colourId: string | undefined): string | null {
  const screen = colourId === undefined ? undefined : resolveColour(env.stack, env.colourwayId, colourId)?.screen;
  return screen === undefined || !/^#[0-9a-fA-F]{6}$/.test(screen) ? null : screen.toLowerCase();
}

export const stackIsFromPicture = (stack: ArtworkStack): boolean => stack.layers.some((layer) => layer.provenance === "read-from-image");
