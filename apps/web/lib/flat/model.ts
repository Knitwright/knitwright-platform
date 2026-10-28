/**
 * The geometry model of a flat: everything a renderer needs and nothing it cannot draw.
 * Both renderers (SVG and PDF) support exactly these parts: named layers, paths made of
 * move, line, cubic curve and close commands, text, and image placements.
 *
 * Every coordinate is in tenths of a millimetre, in one system with ONE scale for both
 * axes. The x axis runs right and the y axis runs down. The centre line of the garment
 * is x = 0 and the high point of the shoulder, where it meets the neck, is y = 0.
 * There are no pixels in this model.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type PathCommand =
  | { readonly op: "M"; readonly to: Point }
  | { readonly op: "L"; readonly to: Point }
  | { readonly op: "C"; readonly c1: Point; readonly c2: Point; readonly to: Point }
  | { readonly op: "Z" };

export interface Stroke {
  readonly colour: string;
  readonly width: number;
  /** Alternating dash and gap lengths. Empty means a solid line. */
  readonly dash: readonly number[];
}

export interface FlatPath {
  readonly kind: "path";
  /** A plain name for the part, such as "Body front". */
  readonly name: string;
  /** The panel this path draws, or null for lines and details. */
  readonly panelId: string | null;
  readonly commands: readonly PathCommand[];
  /** A colour written `#rrggbb`, or null for no fill. */
  readonly fill: string | null;
  readonly stroke: Stroke | null;
}

export type TextAnchor = "start" | "middle" | "end";

export interface FlatText {
  readonly kind: "text";
  readonly text: string;
  readonly at: Point;
  readonly size: number;
  readonly anchor: TextAnchor;
  readonly colour: string;
  /** Degrees clockwise about `at`. */
  readonly rotation: number;
}

export interface FlatImage {
  readonly kind: "image";
  /** The stored file. The renderer is handed the bytes by id. */
  readonly fileId: string;
  /** The centre of the picture. */
  readonly at: Point;
  readonly width: number;
  readonly height: number;
  /** Degrees clockwise about the centre. */
  readonly rotation: number;
}

export type FlatElement = FlatPath | FlatText | FlatImage;

export interface FlatLayer {
  /** A short id, used for the SVG group. See LAYERS. */
  readonly id: string;
  /** The name shown in drawing tools. */
  readonly label: string;
  readonly elements: readonly FlatElement[];
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export type View = "front" | "back";

export interface MissingPoint {
  readonly pointId: string;
  readonly label: string;
}

export interface FlatModel {
  readonly view: View;
  readonly typeId: string;
  readonly colourwayId: string;
  /** In drawing order, first drawn first. */
  readonly layers: readonly FlatLayer[];
  /** Holds everything drawn, with a small margin. */
  readonly bounds: Bounds;
  /** True only when every measurement the drawing needs is present and they fit together. */
  readonly toScale: boolean;
  /** Measurements the drawing needs and does not have. */
  readonly missing: readonly MissingPoint[];
  /** Plain sentences saying why measurements that are present cannot be drawn together. */
  readonly problems: readonly string[];
  /** A sentence to show beside the drawing when it is not to scale, otherwise null. */
  readonly notice: string | null;
  /**
   * The whole garment as one closed silhouette (body, sleeves and collar together), and the
   * boundary of the neck opening. A 3D form is made from these. They are not layers.
   */
  readonly outline: {
    readonly silhouette: readonly PathCommand[];
    readonly neck: readonly PathCommand[];
  };
  /** Named points, in drawing units, that tests and callouts refer to. */
  readonly landmarks: Readonly<Record<string, Point>>;
  /** The drawing described in words. */
  readonly description: string;
}

/**
 * The layers, in drawing order. Step 9 exports SVG with these names, so they are part of
 * the contract with the people who open the files. Change them only on purpose.
 */
export const LAYERS = {
  panels: { id: "panels", label: "Panels" },
  seams: { id: "seams", label: "Seams" },
  stitching: { id: "stitching", label: "Stitching" },
  details: { id: "details", label: "Details" },
  artwork: { id: "artwork", label: "Artwork" },
  measurements: { id: "measurements", label: "Measurements" },
} as const;

export type LayerKey = keyof typeof LAYERS;

export const NOT_TO_SCALE_MISSING = "Not to scale. Some measurements are missing.";
export const NOT_TO_SCALE_MISFIT = "Not to scale. Some measurements do not fit together.";

/** A drawing size used only when nothing at all is known. It is never shown as a measurement. */
export const SCHEMATIC_CHEST = 5200;

/** Room left around everything drawn, in tenths of a millimetre. */
export const BOUNDS_MARGIN = 150;
