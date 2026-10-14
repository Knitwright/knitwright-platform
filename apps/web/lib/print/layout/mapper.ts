import type { PieceHit, PieceMapper, PointMm, ViewId } from "@/lib/artwork-stack";
import type { GradedPattern } from "@/lib/production/contract";
import { anchorsFromInstances, frameFor, type DesignAnchors, type PieceFrame } from "../frames/frame";
import { instancesOf, type PieceInstance, type PieceRoles } from "../frames/instances";
import { apply, type Pt } from "../geometry/affine";
import { pointInRing, round2 } from "../geometry/polygon";

export interface PrintMapper extends PieceMapper {
  readonly anchors: DesignAnchors;
  /** The things printed for one size, with how each lies on the design plane. */
  placed(size: string): readonly { readonly instance: PieceInstance; readonly frame: PieceFrame }[];
}

export interface MapperOptions {
  /** The size the design plane is taken from when no flat supplies anchors. Defaults to the first size. */
  readonly baseSize?: string;
  readonly anchors?: DesignAnchors;
  readonly roles?: PieceRoles;
}

/**
 * The real PieceMapper (decision 0034: the piece is the master). A design point goes to the pattern piece of that view
 * for one size, by a turn and a move fixed by landmarks, so the same design lands in the same place on every size.
 * A point on no piece gives null. Coordinates are those of the opened piece.
 */
export function createPieceMapper(pattern: GradedPattern, options: MapperOptions = {}): PrintMapper {
  const baseSize = options.baseSize ?? pattern.sizes[0] ?? "";
  const anchors = options.anchors ?? anchorsFromInstances(instancesOf(pattern.piecesBySize[baseSize] ?? [], baseSize, options.roles).instances);
  const cache = new Map<string, readonly { instance: PieceInstance; frame: PieceFrame }[]>();
  const placed = (size: string) => {
    const known = cache.get(size);
    if (known) return known;
    const made = instancesOf(pattern.piecesBySize[size] ?? [], size, options.roles).instances.map((instance) => ({ instance, frame: frameFor(instance, anchors) }));
    cache.set(size, made);
    return made;
  };
  return {
    anchors,
    placed,
    toPiece(view: ViewId, point: PointMm, size: string): PieceHit | null {
      for (const { instance, frame } of placed(size)) {
        if (instance.view !== view) continue;
        const at = apply(frame.toPiece, [point.x, point.y] as Pt);
        if (pointInRing(at, instance.opened)) return { pieceId: instance.id, xMm: round2(at[0]), yMm: round2(at[1]) };
      }
      return null;
    },
  };
}
