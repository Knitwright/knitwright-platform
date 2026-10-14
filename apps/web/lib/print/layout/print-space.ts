import type { PointMm } from "@/lib/artwork-stack";
import { dot, sub, type Pt } from "../geometry/vec";
import type { ViewFrame } from "./mapper";
import type { LayoutMapper } from "./mapper";

export interface ShrinkScale {
  /** Along the length of the piece (the way the fabric runs). */
  readonly length: number;
  /** Across the piece. */
  readonly width: number;
}

export const NO_SCALE: ShrinkScale = Object.freeze({ length: 1, width: 1 });

/**
 * Where artwork goes on the printed page for one view and size: design plane to the piece, then the shrink scale
 * about the piece's centre line at the chest line, so art and cut line grow together (plan, case 6).
 */
export interface PrintSpace {
  readonly frame: ViewFrame;
  readonly scale: ShrinkScale;
  readonly toPrint: (point: PointMm) => Pt;
  readonly toPlane: (point: Pt) => PointMm;
  /** A point of the pattern (millimetres on the piece) as it prints. */
  readonly scalePiecePoint: (point: Pt) => Pt;
  /** The cut outline as it prints. */
  readonly outline: readonly Pt[];
}

export function createPrintSpace(mapper: LayoutMapper, view: Parameters<LayoutMapper["frame"]>[0], size: string, scale: ShrinkScale): PrintSpace | null {
  const frame = mapper.frame(view, size);
  if (frame === null) return null;
  const { origin, right, down, wornOrigin } = frame;
  const scalePiecePoint = (p: Pt): Pt => {
    const rel = sub(p, origin);
    const [a, b] = [dot(rel, right) * scale.width, dot(rel, down) * scale.length];
    return [origin[0] + right[0] * a + down[0] * b, origin[1] + right[1] * a + down[1] * b];
  };
  return {
    frame,
    scale,
    scalePiecePoint,
    outline: frame.opened.outline.map(scalePiecePoint),
    toPrint: (point) => {
      const [x, y] = [(point.x - wornOrigin[0]) * scale.width, (point.y - wornOrigin[1]) * scale.length];
      return [origin[0] + right[0] * x + down[0] * y, origin[1] + right[1] * x + down[1] * y];
    },
    toPlane: (point) => {
      const rel = sub(point, origin);
      return { x: dot(rel, right) / scale.width + wornOrigin[0], y: dot(rel, down) / scale.length + wornOrigin[1] };
    },
  };
}
