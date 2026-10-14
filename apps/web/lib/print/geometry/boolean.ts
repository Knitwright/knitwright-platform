import { FillRule, differenceD, intersectD } from "clipper2-ts";
import { boundsOf, boxesOverlap, signedArea, type Box, type Pt } from "./vec";

/** Clipper works at this many decimals, the 0.01 mm the files are written at. */
const PRECISION = 2;

/** One filled shape: its outer rings and any holes, drawn with the even-odd rule. */
export type Shape = readonly (readonly Pt[])[];

const toPaths = (rings: Shape) => rings.map((ring) => ring.map(([x, y]) => ({ x, y })));
const fromPaths = (paths: readonly (readonly { x: number; y: number }[])[]): Shape => paths.map((path) => path.map((p): Pt => [p.x, p.y]));

/** Net area of a shape in square millimetres: holes take away. Clipper gives holes the opposite direction. */
export const shapeArea = (shape: Shape): number => Math.abs(shape.reduce((sum, ring) => sum + signedArea(ring), 0));
export const shapesArea = (shapes: readonly Shape[]): number => shapes.reduce((sum, shape) => sum + shapeArea(shape), 0);

export const shapeBounds = (shape: Shape): Box => boundsOf(shape.flat());

const insideBox = (inner: Box, outer: Box): boolean => inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY;

/**
 * Keeps the part of each shape inside the outline. A shape wholly outside the outline's box is dropped. A shape inside
 * the box that the outline does not cut is returned as it is. Only a shape that crosses the edge is cut.
 */
export function clipToOutline(shapes: readonly Shape[], outline: readonly Pt[]): Shape[] {
  const box = boundsOf(outline);
  const out: Shape[] = [];
  for (const shape of shapes) {
    const sb = shapeBounds(shape);
    if (!boxesOverlap(sb, box)) continue;
    const cut = intersectD(toPaths(shape), toPaths([outline]), FillRule.NonZero, PRECISION);
    const result = fromPaths(cut);
    if (result.length === 0) continue;
    // The cut rewrites the points, so a shape that is untouched keeps its own.
    out.push(insideBox(sb, box) && Math.abs(shapeArea(result) - shapeArea(shape)) < 1e-6 ? shape : result);
  }
  return out;
}

/**
 * Takes regions away from shapes (the clear space around a mark). A shape no region touches is returned as given.
 */
export function subtractRegions(shapes: readonly Shape[], regions: readonly (readonly Pt[])[]): Shape[] {
  if (regions.length === 0) return [...shapes];
  const boxes = regions.map(boundsOf);
  const out: Shape[] = [];
  for (const shape of shapes) {
    const sb = shapeBounds(shape);
    const touching = regions.filter((_, at) => boxesOverlap(sb, boxes[at]));
    if (touching.length === 0) {
      out.push(shape);
      continue;
    }
    const result = fromPaths(differenceD(toPaths(shape), toPaths(touching), FillRule.NonZero, PRECISION));
    if (result.length > 0) out.push(result);
  }
  return out;
}
