import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp, { type Sharp } from "sharp";
import type { PieceScene } from "@/lib/print/scene";
import { rasterise } from "./raster";

export interface TiffOptions {
  /** An ICC profile to convert to and embed. */
  readonly icc?: Uint8Array;
  /** Lowers the pixel cap; for tests. */
  readonly pixelCap?: number;
}

export interface TiffResult {
  readonly bytes: Uint8Array;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly dpi: number;
  readonly dpiNote: string | null;
}

/** The profile reaches sharp as a file: a unique name in the temp folder, removed afterwards. */
async function withProfileFile<T>(icc: Uint8Array, run: (file: string) => Promise<T>): Promise<T> {
  const file = path.join(tmpdir(), `knitwright-${randomUUID()}.icc`);
  await writeFile(file, icc);
  try {
    return await run(file);
  } finally {
    await rm(file, { force: true });
  }
}

/**
 * The whole page as an RGB TIFF on white, with guides and margin, at the scene's resolution (or lower if capped). sharp cannot write a TIFF
 * ImageDescription, so the notes travel in the SVG and PDF only.
 */
export async function renderTiff(scene: PieceScene, options: TiffOptions = {}): Promise<TiffResult> {
  const raster = await rasterise(scene, { background: "#ffffff", art: true, guides: true, margin: true, pixelCap: options.pixelCap });
  const flat = (): Sharp =>
    sharp(raster.png)
      .removeAlpha()
      .withMetadata({ density: raster.dpi });
  const write = (pipeline: Sharp): Promise<Buffer> => pipeline.tiff({ compression: "deflate" }).toBuffer();
  const buffer = options.icc ? await withProfileFile(options.icc, (file) => write(flat().withIccProfile(file))) : await write(flat());
  return { bytes: new Uint8Array(buffer), widthPx: raster.widthPx, heightPx: raster.heightPx, dpi: raster.dpi, dpiNote: raster.dpiNote };
}
