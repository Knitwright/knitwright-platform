import sharp from "sharp";
import type { ArtworkAsset, AssetColourSpace, AssetReader } from "@/lib/artwork-stack";
import { encodeVectorCopy, type VectorCopy } from "../layout/vector-asset";

/** A stand-in for the artwork intake's asset reader (W7b). It answers with real bytes, so the print files can be tested end to end. */
export interface TestAsset {
  readonly id: string;
  readonly kind: "raster" | "vector";
  readonly widthPx: number;
  readonly heightPx: number;
  readonly dpiMeta: number | null;
  readonly colourSpace?: AssetColourSpace;
  readonly hasAlpha?: boolean;
  readonly bytes: Uint8Array;
}

export function createTestAssetReader(assets: readonly TestAsset[]): AssetReader {
  return {
    getAsset: async (id): Promise<ArtworkAsset | null> => {
      const found = assets.find((a) => a.id === id);
      if (found === undefined) return null;
      return {
        id: found.id,
        kind: found.kind,
        widthPx: found.widthPx,
        heightPx: found.heightPx,
        dpiMeta: found.dpiMeta,
        colourSpace: found.colourSpace ?? "srgb",
        hasAlpha: found.hasAlpha ?? false,
        readPrintCopy: async () => found.bytes,
        readScreenCopy: async () => found.bytes,
      };
    },
  };
}

export const FIDUCIAL_PX = 200;
/** Where the test card's marks are, as shares of its width and height (centres). */
export const FIDUCIALS: readonly (readonly [number, number])[] = [[0.1, 0.1], [0.9, 0.1], [0.5, 0.5], [0.1, 0.9], [0.9, 0.9]];

/** A test card: a flat grey field with black squares at known places. Compresses well, so a 6000 x 8000 one is cheap to hold. */
export async function testCard(widthPx: number, heightPx: number): Promise<TestAsset> {
  const mark = await sharp({ create: { width: FIDUCIAL_PX, height: FIDUCIAL_PX, channels: 3, background: "#000000" } }).png().toBuffer();
  const png = await sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: "#d8d8d8" } })
    .composite(FIDUCIALS.map(([u, v]) => ({ input: mark, left: Math.round(u * widthPx - FIDUCIAL_PX / 2), top: Math.round(v * heightPx - FIDUCIAL_PX / 2) })))
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { id: "card", kind: "raster", widthPx, heightPx, dpiMeta: null, bytes: new Uint8Array(png) };
}

/** A square raster with a transparent corner, for logos. */
export async function squareLogo(id: string, px: number, dpiMeta: number | null = 300): Promise<TestAsset> {
  const png = await sharp({ create: { width: px, height: px, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }).png().toBuffer();
  return { id, kind: "raster", widthPx: px, heightPx: px, dpiMeta, hasAlpha: true, bytes: new Uint8Array(png) };
}

/** A vector logo: a square with a square hole, in the logo's own units. */
export function vectorLogo(id: string, size = 100): TestAsset {
  const copy: VectorCopy = {
    kind: "vector",
    width: size,
    height: size,
    shapes: [
      {
        fill: "#102a56",
        rings: [
          [[0, 0], [size, 0], [size, size], [0, size]],
          [[size * 0.3, size * 0.3], [size * 0.3, size * 0.7], [size * 0.7, size * 0.7], [size * 0.7, size * 0.3]],
        ],
      },
    ],
  };
  return { id, kind: "vector", widthPx: size, heightPx: size, dpiMeta: null, bytes: encodeVectorCopy(copy) };
}
