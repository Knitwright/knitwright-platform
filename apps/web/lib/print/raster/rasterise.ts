import sharp from "sharp";

/** Turns an SVG document (shapes and pictures only) into pixels. No network, no scripts: the document is ours. */
export async function svgToPng(svg: string): Promise<Uint8Array> {
  return new Uint8Array(await sharp(Buffer.from(svg), { limitInputPixels: false }).png({ compressionLevel: 6, adaptiveFiltering: false }).toBuffer());
}

/** Raw pixels, three channels, on a flat background so no transparency is left. */
export async function svgToRaw(svg: string, widthPx: number, heightPx: number): Promise<Buffer> {
  const { data, info } = await sharp(Buffer.from(svg), { limitInputPixels: false })
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== widthPx || info.height !== heightPx) throw new Error("The strip came out at a different size than asked.");
  return data;
}
