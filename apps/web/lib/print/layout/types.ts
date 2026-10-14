import type { ArtworkStack, AssetReader, PatternGenerator, PointMm } from "@/lib/artwork-stack";
import type { PrintRuleSet, PrintZone, RosterRow } from "@/lib/production/contract";
import type { PieceFrame } from "../frames/frame";
import type { PieceInstance } from "../frames/instances";
import type { Affine } from "../geometry/affine";
import type { Box, PrintIssue, Ring, SceneItem } from "../scene";

/** What a print file is made with, besides the design: the print house's numbers and the fabric's shrink. */
export interface PrintSettings {
  readonly bleedMm: number;
  /** The resolution pictures are printed at. */
  readonly dpi: number;
  /** Pictures under this many dots per inch get a warning. */
  readonly minDpi: number;
  /** Shrink scale along the piece's x and y axes (1 = not scaled). */
  readonly scaleX: number;
  readonly scaleY: number;
  /** Said in the margin when the file is not scaled for shrink, else null. */
  readonly scaleNote: string | null;
  /** Said in the margin when bleed, dpi or avoid list are Knitwright's own defaults. */
  readonly defaultsNote: string | null;
  readonly patternReviewed: boolean;
}

export interface LayoutInput {
  readonly stack: ArtworkStack;
  readonly colourwayId: string;
  readonly instance: PieceInstance;
  readonly frame: PieceFrame;
  readonly anchors: Readonly<Record<string, PointMm>>;
  readonly zones: readonly PrintZone[];
  /** The design-space box every piece's pattern is drawn over (see `fieldBoundsFor`). */
  readonly field: Box;
  /** Where the back's field is read by, so it meets the front's at the side seam (see `seamJoinFor`). Undefined: drawn as it is. */
  readonly seamJoinMm?: number;
  readonly settings: PrintSettings;
  readonly rules: PrintRuleSet;
  readonly generators: readonly PatternGenerator[];
  readonly assets: AssetReader;
  readonly player: RosterRow | null;
  /** Build only the layers whose technique is a transfer (name and number layers), for a transfer-only set. */
  readonly transferOnly?: boolean;
}

/** The geometry every layer works in: unscaled piece millimetres, with the region that is drawn. */
export interface LayerSpace {
  readonly input: LayoutInput;
  /** Where the art may go: the bleed outline, in unscaled piece space. */
  readonly visible: Ring;
  readonly visibleBox: Box;
  readonly toPiece: Affine;
  readonly toDesign: Affine;
  readonly chestY: number;
}

/** A shape in the scene while it is being built, with what kind of layer made it. */
export interface Built {
  readonly item: SceneItem;
  readonly kind: "ground" | "pattern" | "image-fill" | "graphic" | "text" | "player-mark";
}

/** A mark that was placed, for the checks that it stayed in its zone. The ring is in unscaled piece millimetres. */
export interface PlacedMark {
  readonly layerId: string;
  readonly ring: Ring;
  /** The zone it was placed in, or null for a free anchor. */
  readonly zoneId: string | null;
  readonly inZone: boolean;
}

export interface LayerResult {
  readonly built: readonly Built[];
  /** Regions (unscaled piece space) cleared of the pattern and picture layers drawn before this one. */
  readonly knock: readonly Ring[];
  readonly issues: readonly PrintIssue[];
  /** Screen colours this layer prints, for the avoid list. */
  readonly colours: readonly string[];
  /** Dots per inch of each picture on this layer. */
  readonly dpis: readonly number[];
  readonly marks?: readonly PlacedMark[];
}
