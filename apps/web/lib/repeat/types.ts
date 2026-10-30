/**
 * The repeat (pattern-fill) maker (spec F-S4 "Repeat / pattern-fill maker", plan v5 Y8, decision 0081).
 *
 * A repeat is a tile and the rule for laying that tile out. The tile holds layers: a picture the
 * person uploaded (screened by moderation before it was stored, X8 `screenUpload`) or a shape they
 * drew. Everything here is measured in tenths of a millimetre, as the rest of the platform is
 * (`lib/garment/units.ts`); centimetres and inches are what the person types, never what is kept.
 *
 * Nothing in this module draws pixels. It answers where a tile goes, what crosses its bounds and
 * what is wrong with it; the panel and the print files draw from those answers.
 */

/** The four repeat styles of the spec, in the order the panel shows them. */
export const REPEAT_STYLES = ["full-drop", "half-drop", "brick", "mirror"] as const;
export type RepeatStyle = (typeof REPEAT_STYLES)[number];

export const REPEAT_STYLE_LABELS: Readonly<Record<RepeatStyle, string>> = {
  "full-drop": "Full drop",
  "half-drop": "Half-drop",
  brick: "Brick",
  mirror: "Mirror",
};

/** What each style does, in the words the panel shows under its name. */
export const REPEAT_STYLE_NOTES: Readonly<Record<RepeatStyle, string>> = {
  "full-drop": "The tile repeats straight across and straight down.",
  "half-drop": "Every second column drops by half a tile.",
  brick: "Every second row shifts across by half a tile.",
  mirror: "Every second column and row is flipped, so the tile meets itself.",
};

/** The units a person may type a tile size in. The tile is kept in tenths of a millimetre either way. */
export const TILE_UNITS = ["cm", "in"] as const;
export type TileUnit = (typeof TILE_UNITS)[number];

export const TILE_UNIT_LABELS: Readonly<Record<TileUnit, string>> = { cm: "Centimetres", in: "Inches" };

/** The tile's own size, in tenths of a millimetre. */
export type TileSize = Readonly<{ widthTenths: number; heightTenths: number }>;

/** A drawn shape, for a repeat somebody makes without a picture. */
export const DRAWN_SHAPES = ["circle", "square", "stripe"] as const;
export type DrawnShape = (typeof DRAWN_SHAPES)[number];

export const DRAWN_SHAPE_LABELS: Readonly<Record<DrawnShape, string>> = { circle: "Circle", square: "Square", stripe: "Stripe" };

/**
 * One thing on the tile. A picture layer names the stored artwork it draws, which went through
 * moderation on its way in; a drawn layer names a shape instead. A layer is placed by its centre,
 * so flipping and rotating it do not move it.
 */
export type RepeatLayer = Readonly<{
  id: string;
  label: string;
  /** The stored artwork this layer draws, or null for a drawn shape. */
  artworkId: string | null;
  /** The shape this layer draws, or null for a picture. */
  shape: DrawnShape | null;
  /** `#rrggbb`. A picture layer keeps its own colours; the colour tints a drawn shape. */
  colour: string;
  /** The centre of the layer, in tenths of a millimetre from the tile's top-left corner. */
  xTenths: number;
  yTenths: number;
  widthTenths: number;
  heightTenths: number;
  /** Whole degrees, clockwise. */
  rotationDeg: number;
  /** The picture's own pixels, for the resolution check. Null for a drawn shape, which has none. */
  sourcePx: Readonly<{ width: number; height: number }> | null;
}>;

/** A repeat as the panel holds it, before it is published. */
export type RepeatDraft = Readonly<{
  name: string;
  /** The unit the person is typing in. It changes nothing about the tile itself. */
  unit: TileUnit;
  tile: TileSize;
  style: RepeatStyle;
  /** `#rrggbb` behind every layer. */
  background: string;
  /**
   * True when a layer that runs off one edge of the tile comes back on the opposite edge, so the
   * repeat has no seam. False leaves the tile's bounds as a hard edge and the layer is cut.
   */
  wrap: boolean;
  /** Bottom layer first, as the panel lists them from the back forward. */
  layers: readonly RepeatLayer[];
}>;

/** `#rrggbb`, lower case. The one colour shape every panel in the platform already uses. */
export const COLOUR_PATTERN = /^#[0-9a-f]{6}$/;

/** A new repeat, before anyone has typed anything: one 10 cm tile, full drop, on white. */
export const BLANK_DRAFT: RepeatDraft = {
  name: "",
  unit: "cm",
  tile: { widthTenths: 1000, heightTenths: 1000 },
  style: "full-drop",
  background: "#ffffff",
  wrap: true,
  layers: [],
};
