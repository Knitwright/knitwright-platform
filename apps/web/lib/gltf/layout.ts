import type { ViewId } from "@/lib/artwork-stack";
import { DEFAULT_PIECE_ROLES, instancesOf, type PieceRoles } from "@/lib/print/frames/instances";
import type { Ring } from "@/lib/print/scene";
import type { GradedPattern } from "@/lib/production/contract";

/**
 * The panel layout: where each printed panel lies in the one 2048 by 2048 picture a model is textured from. The panels are
 * those of the print files (`instancesOf`, decisions 0031 and 0034), at one scale, so a rectangle here is the panel in
 * millimetres times `pxPerMm`. Rectangles use glTF texture coordinates: u to the right, v DOWN from the top of the picture.
 */
export const TEXTURE_SIZE = 2048;
const PADDING_PX = 8;
const MAX_PX_PER_MM = 4;
const MIN_PX_PER_MM = 0.05;

export type PanelGroup = "body" | "sleeve" | "collar";

export interface PanelRect {
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

export interface LayoutPanel {
  readonly id: ViewId;
  readonly group: PanelGroup;
  readonly pieceName: string;
  readonly widthMm: number;
  readonly heightMm: number;
  /** The opened cut outline in millimetres, y up, moved so the lower left corner of its box is (0, 0). */
  readonly outline: Ring;
  readonly rect: PanelRect;
}

export interface PanelLayout {
  readonly textureSize: typeof TEXTURE_SIZE;
  readonly size: string;
  readonly pxPerMm: number;
  readonly panels: readonly LayoutPanel[];
}

export interface LayoutOptions {
  readonly roles?: PieceRoles;
  /** Fix the scale, for example to keep every size on the scale of the base size. Refused when the panels do not fit. */
  readonly pxPerMm?: number;
}

export function panelGroupOf(id: ViewId): PanelGroup {
  if (id === "front" || id === "back") return "body";
  return id === "collar" ? "collar" : "sleeve";
}

interface Shape {
  readonly id: ViewId;
  readonly pieceName: string;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly outline: Ring;
}

interface Slot {
  readonly x: number;
  readonly y: number;
}

/** Rows from the top, tallest panel first; null when the panels do not fit at this scale. */
function pack(shapes: readonly Shape[], scale: number): readonly Slot[] | null {
  const order = shapes.map((s, i) => ({ s, i })).sort((a, b) => b.s.heightMm - a.s.heightMm || a.i - b.i);
  const slots: Slot[] = Array.from({ length: shapes.length }, () => ({ x: 0, y: 0 }));
  let x = PADDING_PX;
  let y = PADDING_PX;
  let rowHeight = 0;
  for (const { s, i } of order) {
    const w = Math.ceil(s.widthMm * scale);
    const h = Math.ceil(s.heightMm * scale);
    if (x + w + PADDING_PX > TEXTURE_SIZE) {
      x = PADDING_PX;
      y += rowHeight + PADDING_PX;
      rowHeight = 0;
    }
    if (x + w + PADDING_PX > TEXTURE_SIZE || y + h + PADDING_PX > TEXTURE_SIZE) return null;
    slots[i] = { x, y };
    x += w + PADDING_PX;
    rowHeight = Math.max(rowHeight, h);
  }
  return slots;
}

/** The largest scale at which the panels fit, found by halving the gap. */
function fitScale(shapes: readonly Shape[]): number {
  if (pack(shapes, MAX_PX_PER_MM)) return MAX_PX_PER_MM;
  let low = MIN_PX_PER_MM;
  let high = MAX_PX_PER_MM;
  if (!pack(shapes, low)) throw new Error("The panels do not fit in the picture at any usable scale.");
  for (let i = 0; i < 30; i += 1) {
    const mid = (low + high) / 2;
    if (pack(shapes, mid)) low = mid;
    else high = mid;
  }
  return Math.floor(low * 1e4) / 1e4;
}

function shapeOf(id: ViewId, pieceName: string, ring: Ring): Shape {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    id,
    pieceName,
    widthMm: Math.max(...xs) - minX,
    heightMm: Math.max(...ys) - minY,
    outline: ring.map((p) => [p[0] - minX, p[1] - minY] as const),
  };
}

/** The layout for one size of a pattern. Pure: the pattern is not changed and the same pattern gives the same layout. */
export function buildPanelLayout(pattern: GradedPattern, size: string, options: LayoutOptions = {}): PanelLayout {
  const pieces = pattern.piecesBySize[size];
  if (!pieces) throw new Error(`The pattern has no size ${size}.`);
  const { instances } = instancesOf(pieces, size, options.roles ?? DEFAULT_PIECE_ROLES);
  if (instances.length === 0) throw new Error(`Size ${size} has no piece that is printed.`);
  const shapes = instances.map((i) => shapeOf(i.id, i.pieceName, i.opened));
  const scale = options.pxPerMm ?? fitScale(shapes);
  const slots = pack(shapes, scale);
  if (!slots) throw new Error(`The panels do not fit in ${TEXTURE_SIZE} pixels at ${scale} pixels per millimetre.`);
  return {
    textureSize: TEXTURE_SIZE,
    size,
    pxPerMm: scale,
    panels: shapes.map((s, i) => {
      const slot = slots[i] as Slot;
      return {
        ...s,
        group: panelGroupOf(s.id),
        rect: {
          u0: slot.x / TEXTURE_SIZE,
          v0: slot.y / TEXTURE_SIZE,
          u1: (slot.x + s.widthMm * scale) / TEXTURE_SIZE,
          v1: (slot.y + s.heightMm * scale) / TEXTURE_SIZE,
        },
      };
    }),
  };
}
