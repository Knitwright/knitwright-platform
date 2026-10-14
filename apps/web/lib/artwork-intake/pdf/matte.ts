import sharp from "sharp";

/**
 * Recovers a see-through picture from the same page drawn twice, once on white and once on black. With colour C
 * and opacity a, white shows a*C + (1-a)*255 and black shows a*C, so a = 1 - (white - black)/255 and C = black / a.
 * (The reader cannot draw on a see-through background itself.)
 */
export const matte = async (onWhite: Buffer, onBlack: Buffer): Promise<Buffer> => {
  const read = (png: Buffer) => sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [white, black] = await Promise.all([read(onWhite), read(onBlack)]);
  const { width, height } = white.info;
  if (black.info.width !== width || black.info.height !== height) throw new Error("The two drawings of the page differ in size.");
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const at = i * 4;
    const spread = ((white.data[at] - black.data[at]) + (white.data[at + 1] - black.data[at + 1]) + (white.data[at + 2] - black.data[at + 2])) / 3;
    const alpha = Math.min(1, Math.max(0, 1 - spread / 255));
    if (alpha < 1 / 255) continue;
    for (let c = 0; c < 3; c += 1) out[at + c] = Math.min(255, Math.round(black.data[at + c] / alpha));
    out[at + 3] = Math.round(alpha * 255);
  }
  return sharp(out, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
};
