import sharp from "sharp";
import { labelAsAi } from "@/lib/media/lifestyle/label";
import type { ShootProvider, ShootRequest } from "./provider";

/**
 * THE DETERMINISTIC STUB (plan v5 rule: "every provider is an interface with a deterministic stub; a
 * real adapter sits behind an env key and is never called in CI").
 *
 * What it does is the honest minimum: it takes the locked garment picture it was given, puts it on a
 * plain backdrop of its own, and marks the result as AI-generated in the PNG's own metadata with the
 * same function the existing lifestyle pictures use (`lib/media/lifestyle/label.ts`).
 *
 * **It draws no person, no room and no light.** A stub that pretended to be a photograph would be a
 * worse lie than a plain backdrop, and the whole product is built on not telling that kind of lie.
 * The garment is left exactly where it was, which is also what makes the stub useful: the picture
 * checker measures the result against the same render, so a run through the stub exercises the real
 * path -- cost, moderation, checker, refund -- without a paid call and without a made-up photograph.
 *
 * The same request always gives the same bytes: the backdrop colour comes from the seed, so two
 * attempts of one shoot differ and a rerun of the same attempt repeats.
 */

const STUB_NAME = "stub-shoot";

/** The plain backdrops the stub paints on, dark enough that the garment's own edges stay readable. */
const SHADES: readonly string[] = ["#dcdcdc", "#cfd6dd", "#d8d3cb", "#c9d2c6", "#d5cfd8"];

export const stubShade = (seed: number): string => SHADES[Math.abs(Math.trunc(seed)) % SHADES.length] as string;

const flat = (width: number, height: number, hex: string): Buffer =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${hex}"/></svg>`);

/** The stub's picture: the garment, unchanged, on a plain shade chosen by the seed. */
export async function stubShootImage(request: ShootRequest): Promise<Uint8Array> {
  const { width = 0, height = 0 } = await sharp(request.garment).metadata();
  const canvas = { width: Math.max(1, width), height: Math.max(1, height) };
  const out = await sharp(flat(canvas.width, canvas.height, stubShade(request.seed)))
    .composite([{ input: Buffer.from(request.garment) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  return labelAsAi(new Uint8Array(out), { provider: STUB_NAME, scene: request.sceneSlug });
}

export const stubShootProvider = (): ShootProvider => ({
  name: STUB_NAME,
  costPerImageMicrodollars: 0,
  async generate(request) {
    return { ok: true, png: await stubShootImage(request) };
  },
});

/**
 * A stub that fails, for the tests of the refund path. It is exported rather than written inside a
 * test because every workstream's run tests need the same one, and a failure that is not the one the
 * real code can produce is a test that proves nothing.
 */
export const failingShootProvider = (message: string): ShootProvider => ({
  name: `${STUB_NAME}-failing`,
  costPerImageMicrodollars: 0,
  async generate() {
    return { ok: false, message };
  },
});
