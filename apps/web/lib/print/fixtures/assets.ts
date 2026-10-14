import sharp from "sharp";
import type { ArtworkAsset, AssetReader } from "@/lib/artwork-stack";

/** A test card: a grey field with a red square in each corner, to see where art lands. */
export async function testCardPng(widthPx: number, heightPx: number): Promise<Uint8Array> {
  const mark = Math.round(widthPx / 20);
  const square = (left: number, top: number) => ({
    input: { create: { width: mark, height: mark, channels: 3 as const, background: "#ff0000" } },
    left,
    top,
  });
  const png = await sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: "#8899aa" } })
    .composite([square(0, 0), square(widthPx - mark, 0), square(0, heightPx - mark), square(widthPx - mark, heightPx - mark)])
    .png()
    .toBuffer();
  return new Uint8Array(png);
}

/** A crest as vector shapes: a navy shield with a gold bar. */
export const CREST_JSON = JSON.stringify({
  version: 1,
  width: 100,
  height: 120,
  shapes: [
    { fill: "#1b2a49", stroke: null, closed: true, rings: [[[0, 0], [100, 0], [100, 80], [50, 120], [0, 80]]] },
    { fill: "#d4af37", stroke: { colour: "#ffffff", widthMm: 1 }, closed: true, rings: [[[10, 40], [90, 40], [90, 60], [10, 60]]] },
  ],
});

export interface FakeAsset {
  readonly id: string;
  readonly kind: "raster" | "vector";
  readonly widthPx: number;
  readonly heightPx: number;
  readonly dpiMeta?: number | null;
  readonly print: Uint8Array;
}

export function assetReader(assets: readonly FakeAsset[]): AssetReader {
  return {
    getAsset: async (id): Promise<ArtworkAsset | null> => {
      const found = assets.find((entry) => entry.id === id);
      if (!found) return null;
      return {
        id: found.id,
        kind: found.kind,
        widthPx: found.widthPx,
        heightPx: found.heightPx,
        dpiMeta: found.dpiMeta ?? null,
        colourSpace: "srgb",
        hasAlpha: false,
        readPrintCopy: async () => found.print,
        readScreenCopy: async () => new Uint8Array(0),
      };
    },
  };
}

export const crestAsset = (): FakeAsset => ({ id: "crest", kind: "vector", widthPx: 100, heightPx: 120, print: new TextEncoder().encode(CREST_JSON) });
