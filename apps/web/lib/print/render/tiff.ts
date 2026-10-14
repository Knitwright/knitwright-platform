import { createHash } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, pipeline } from "node:stream";
import sharp from "sharp";
import type { Shape } from "../geometry/boolean";
import type { PrintSettings } from "../layout/context";
import type { PieceScene } from "../layout/scene";
import { pixelGrid, stripsOf } from "../raster/grid";
import { svgToRaw } from "../raster/rasterise";
import { buildSvg } from "./svg";

export interface TiffOptions {
  readonly settings: Pick<PrintSettings, "iccBytes">;
  readonly guides: boolean;
  readonly slug: readonly Shape[];
  /** Pixels per strip. The memory budget; the default is set in the grid. */
  readonly stripBudget?: number;
}

/** sharp reads an ICC profile from a file, so the bytes are written once under a name made from their hash. */
async function iccPath(bytes: Uint8Array): Promise<string> {
  const dir = join(tmpdir(), "knitwright-icc");
  const file = join(dir, `${createHash("sha256").update(bytes).digest("hex")}.icc`);
  await mkdir(dir, { recursive: true });
  try {
    await access(file);
  } catch {
    await writeFile(file, bytes);
  }
  return file;
}

/**
 * The scene as a TIFF at the file's resolution, built strip by strip: no strip holds more than the pixel budget, so a
 * big piece costs time, not memory. The page is flattened on paper white (sublimation prints no white ink). The print
 * house's ICC profile is attached when the brand has one.
 */
export async function buildTiff(scene: PieceScene, options: TiffOptions): Promise<Uint8Array> {
  const grid = pixelGrid(scene.box, scene.dpi);
  const strips = stripsOf(scene.box, grid, options.stripBudget);
  async function* rows(): AsyncGenerator<Buffer> {
    for (const strip of strips) {
      const svg = buildSvg(scene, {
        region: strip.box,
        pixels: { widthPx: strip.widthPx, heightPx: strip.heightPx },
        guides: options.guides,
        slug: options.slug,
        background: "#ffffff",
      });
      yield await svgToRaw(svg, strip.widthPx, strip.heightPx);
    }
  }
  const input = sharp({ raw: { width: grid.widthPx, height: grid.heightPx, channels: 3 }, sequentialRead: true, limitInputPixels: false });
  // A failure in a strip must reach the caller; a plain pipe would leave the output waiting for ever.
  const failed = new Promise<never>((_, reject) => pipeline(Readable.from(rows()), input, (error) => error && reject(error)));
  let out = input.withMetadata({ density: scene.dpi });
  if (options.settings.iccBytes !== null) out = out.withIccProfile(await iccPath(options.settings.iccBytes), { attach: true });
  const resolution = scene.dpi / 25.4;
  const done = out.tiff({ compression: "lzw", xres: resolution, yres: resolution, resolutionUnit: "inch" }).toBuffer();
  done.catch(() => undefined);
  return new Uint8Array(await Promise.race([done, failed]));
}
