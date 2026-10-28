import sharp from "sharp";
import type { LifestyleProvider } from "./provider";
import { SCENE_IDS, type SceneId } from "./scenes";

/**
 * The provider tests and local runs use. It calls nothing and costs nothing: the garment is laid, slightly relit, on a
 * plain gradient chosen by scene. The same request gives the same bytes. It is not a try-on: the "model" scene is a
 * different gradient and no person is drawn.
 */

const STUB_NAME = "stub-lifestyle";

const GRADIENTS: Readonly<Record<SceneId, readonly [string, string]>> = {
  pitch: ["#9fd0f0", "#3f8f3a"],
  changing_room: ["#d9c3a0", "#8a6a45"],
  street: ["#b8c4d6", "#5b6272"],
  on_model: ["#6f7f95", "#3d4a5c"],
};

/** A light relight, the kind a real scene brings. */
const RELIGHT = { brightness: 0.97 };

const background = (width: number, height: number, [top, bottom]: readonly [string, string]): Buffer =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/></svg>`,
  );

export const stubLifestyleProvider = (): LifestyleProvider => ({
  name: STUB_NAME,
  costMicrodollars: 0,
  scenes: SCENE_IDS,
  async generate({ scene, garment }) {
    const { width = 0, height = 0 } = await sharp(garment).metadata();
    const lit = await sharp(garment).modulate(RELIGHT).png().toBuffer();
    const out = await sharp(background(width, height, GRADIENTS[scene])).composite([{ input: lit }]).png({ compressionLevel: 9 }).toBuffer();
    return new Uint8Array(out);
  },
});
