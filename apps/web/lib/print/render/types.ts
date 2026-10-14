/** The art of a piece written as one picture: what a scene with a blending layer is printed from. */
export interface FlatArt {
  /** RGBA PNG covering the whole page. */
  readonly png: Uint8Array;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly dpi: number;
  /** Set when the resolution had to be lowered to fit the pixel cap. */
  readonly dpiNote: string | null;
}
