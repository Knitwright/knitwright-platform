import type { PieceScene } from "@/lib/print/scene";
import { flattenScene } from "./raster";
import { renderSvg } from "./svg";

/** The SVG of any piece: a scene with a blending layer is flattened first. */
export async function renderSvgAsync(scene: PieceScene): Promise<string> {
  return renderSvg(scene, scene.raster ? await flattenScene(scene) : undefined);
}
