import sharp from "sharp";

/** The words drawn across a preview. */
export const WATERMARK_TEXT = "Knitwright preview";

const STEP = 220;

/**
 * A diagonal pattern of the words and lines over the whole picture. The lines are there so the mark still
 * covers the picture on a machine with no fonts. It is the same for the same size, so the output is deterministic.
 */
export const watermarkSvg = (width: number, height: number): string => {
  const reach = width + height;
  const lines: string[] = [];
  const words: string[] = [];
  for (let offset = -height; offset < reach; offset += STEP) {
    lines.push(`<line x1="${offset}" y1="0" x2="${offset + height}" y2="${height}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3"/>`);
  }
  for (let y = STEP / 2; y < height + STEP; y += STEP) {
    for (let x = ((y / STEP) % 2) * (STEP * 0.9); x < width + STEP; x += STEP * 1.8) {
      words.push(`<text x="${x}" y="${y}" transform="rotate(-30 ${x} ${y})" font-family="sans-serif" font-size="30" font-weight="bold" fill="#202020" fill-opacity="0.55" stroke="#ffffff" stroke-opacity="0.6" stroke-width="1">${WATERMARK_TEXT}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${lines.join("")}${words.join("")}</svg>`;
};

/** The picture with the mark drawn over it, as a PNG. Nothing of the clean file is kept apart from what shows through. */
export async function watermark(png: Uint8Array): Promise<Uint8Array> {
  const { width = 0, height = 0 } = await sharp(png).metadata();
  const out = await sharp(png)
    .composite([{ input: Buffer.from(watermarkSvg(width, height)), top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  return new Uint8Array(out);
}
