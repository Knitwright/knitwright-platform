import type { Bounds, View } from "@/lib/flat/model";
import type { GarmentMesh } from "./mesh";

/** Shown beside the 3D view at all times. */
export const PREVIEW_LABEL = "A preview of shape and colour, not of fit or drape.";
export const OPEN_LABEL = "Show in 3D";
export const CLOSE_LABEL = "Hide 3D";
export const LOADING_LABEL = "Loading the 3D view…";
export const FAILED_LABEL = "The 3D view could not be shown in this browser. The drawing above is unchanged.";
export const HELP_LABEL = "Drag to turn it. Scroll or pinch to come closer.";

export interface ViewerMotion {
  /** Turns slowly by itself until the person takes hold of it. */
  readonly autoRotate: boolean;
  /** How long a move to the front or the back takes. Nought is a jump. */
  readonly easeSeconds: number;
}

/** Nothing moves by itself for a person who has asked their device for less motion. */
export const motionFor = (reducedMotion: boolean): ViewerMotion =>
  reducedMotion ? { autoRotate: false, easeSeconds: 0 } : { autoRotate: true, easeSeconds: 0.6 };

const MARGIN = 1.15;

/**
 * Where the camera stands to see one side of the whole garment, for a camera with this
 * upright field of view (degrees) and this frame shape (width over height). It looks at
 * the middle of the garment.
 */
export function cameraFor(view: View, size: GarmentMesh["size"], fovDegrees: number, aspect: number): readonly [number, number, number] {
  const half = Math.tan(((fovDegrees / 2) * Math.PI) / 180);
  const needed = Math.max(size.height / 2, size.width / 2 / aspect) * MARGIN;
  const distance = needed / half + size.depth / 2;
  return [0, 0, view === "front" ? distance : -distance];
}

/** How close and how far the camera may go, in metres from the middle of the garment. */
export const zoomLimits = (size: GarmentMesh["size"]): { readonly min: number; readonly max: number } => {
  const longest = Math.max(size.width, size.height);
  return { min: Math.max(size.depth, longest * 0.45), max: longest * 4 };
};

/** The size in pixels to paint a flat at, for use as a texture: the flat's shape, `longest` on its longer side. */
export function textureSize(bounds: Bounds, longest: number): { readonly width: number; readonly height: number } {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const scale = longest / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
