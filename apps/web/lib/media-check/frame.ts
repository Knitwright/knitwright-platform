import sharp from "sharp";
import { boxBlur } from "./planes";

/** The longest side of the analysis copy. Both pictures are shrunk to this before any measuring. */
export const ANALYSIS_SIDE = 512;
/** A decompression-bomb guard set before decoding. */
export const MAX_INPUT_PIXELS = 40_000_000;
/** Softens grain and fine texture so a relit or re-rendered copy is not punished for it. */
const BLUR_RADIUS = 1;

/** A picture at analysis size: three blurred colour planes (0 to 255) and the alpha as a 0/1 mask. */
export interface Frame {
  readonly width: number;
  readonly height: number;
  readonly r: Float32Array;
  readonly g: Float32Array;
  readonly b: Float32Array;
  /** 1 where the picture is opaque enough to count as garment. Only the reference carries a real mask. */
  readonly mask: Uint8Array;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

const RAW_OPTIONS = { limitInputPixels: MAX_INPUT_PIXELS } as const;

/** The size of a picture as it will be shown (after the orientation tag), or null if it cannot be read. */
export async function readSize(bytes: Uint8Array): Promise<Size | null> {
  try {
    const meta = await sharp(bytes, RAW_OPTIONS).metadata();
    if (!meta.width || !meta.height) return null;
    const turned = (meta.orientation ?? 1) >= 5;
    return turned ? { width: meta.height, height: meta.width } : { width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

/** The analysis size for a picture: shrunk to fit, never enlarged. */
export function analysisSize(size: Size): Size {
  const scale = Math.min(1, ANALYSIS_SIDE / Math.max(size.width, size.height));
  return { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) };
}

/** Decodes to the given analysis size. A picture without alpha is flattened on white and has a full mask. */
export async function decodeFrame(bytes: Uint8Array, to: Size): Promise<Frame> {
  const { data } = await sharp(bytes, RAW_OPTIONS)
    .rotate()
    .ensureAlpha()
    .resize({ width: to.width, height: to.height, fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = to.width * to.height;
  const [r, g, b] = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = (data[i * 4 + 3] as number) / 255;
    // Over white, so a soft edge or a see-through picture still has a colour.
    r[i] = (data[i * 4] as number) * a + 255 * (1 - a);
    g[i] = (data[i * 4 + 1] as number) * a + 255 * (1 - a);
    b[i] = (data[i * 4 + 2] as number) * a + 255 * (1 - a);
    mask[i] = a >= 0.5 ? 1 : 0;
  }
  return {
    ...to,
    r: boxBlur(r, to.width, to.height, BLUR_RADIUS),
    g: boxBlur(g, to.width, to.height, BLUR_RADIUS),
    b: boxBlur(b, to.width, to.height, BLUR_RADIUS),
    mask,
  };
}

/** Rec. 709 luma of a frame, 0 to 255. */
export function lumaOf(frame: Frame): Float32Array {
  const out = new Float32Array(frame.r.length);
  for (let i = 0; i < out.length; i++) out[i] = 0.2126 * (frame.r[i] as number) + 0.7152 * (frame.g[i] as number) + 0.0722 * (frame.b[i] as number);
  return out;
}
