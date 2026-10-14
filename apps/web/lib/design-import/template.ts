import type { GradedPattern, LandmarkId, PatternPiece } from "@/lib/production/contract";
import { TEE_EU48 } from "@/lib/production/fixtures";
import { VIEW_ANCHORS, type PieceHit, type PieceMapper, type PointMm, type ViewId, roundMm } from "@/lib/artwork-stack";
import { pointInPolygon } from "./outline";

/**
 * What the picture is fitted to: the landmarks of the garment's pattern pieces in an upright plane (millimetres,
 * x across from the centre line, y down from the neck point). The real template comes from W1's pattern library
 * and W3's mapper; until then this builds it from the benchmark tee pieces (W0 fixtures, measured from the DXF)
 * behind the same interface, which is the fallback decision 0034 allows.
 */

export type TemplateLandmarks = Readonly<Partial<Record<LandmarkId, PointMm>>>;

export interface LandmarkTemplate {
  readonly size: string;
  /** Words for the report: what the picture was fitted to. */
  readonly description: string;
  /** Empty for a view that is not fitted (sleeves, collar). */
  landmarks(view: ViewId): TemplateLandmarks;
}

interface Frame {
  readonly origin: readonly [number, number];
  readonly down: readonly [number, number];
  readonly across: readonly [number, number];
}

const unit = (v: readonly [number, number]): readonly [number, number] => {
  const length = Math.hypot(v[0], v[1]);
  return [v[0] / length, v[1] / length];
};

/** The piece's own axes, read from its landmarks (the DXF pieces sit rotated): down runs neck to hem, across runs centre to side. */
function frameOf(piece: PatternPiece, view: "front" | "back"): Frame | null {
  const [neck, hem] = view === "front" ? (["cf-neck", "cf-hem"] as const) : (["cb-neck", "cb-hem"] as const);
  const [n, h, side] = [piece.landmarks[neck], piece.landmarks["side-hem"], piece.landmarks[hem]];
  if (!n || !h || !side) return null;
  const down = unit([side[0] - n[0], side[1] - n[1]]);
  // From the centre line to the side seam, perpendicular to down.
  const raw: readonly [number, number] = [h[0] - side[0], h[1] - side[1]];
  const along = raw[0] * down[0] + raw[1] * down[1];
  const across = unit([raw[0] - along * down[0], raw[1] - along * down[1]]);
  return { origin: n, down, across };
}

const toUpright = (frame: Frame, p: readonly [number, number]): PointMm => {
  const d: readonly [number, number] = [p[0] - frame.origin[0], p[1] - frame.origin[1]];
  return { x: roundMm(d[0] * frame.across[0] + d[1] * frame.across[1]), y: roundMm(d[0] * frame.down[0] + d[1] * frame.down[1]) };
};

const fromUpright = (frame: Frame, q: PointMm): readonly [number, number] => [
  frame.origin[0] + frame.across[0] * q.x + frame.down[0] * q.y,
  frame.origin[1] + frame.across[1] * q.x + frame.down[1] * q.y,
];

const BODY_VIEWS: readonly ViewId[] = ["front", "back"];

const pieceOf = (pattern: GradedPattern, size: string, view: ViewId): PatternPiece | undefined =>
  BODY_VIEWS.includes(view) ? pattern.piecesBySize[size]?.find((piece) => piece.id === view) : undefined;

export function templateFromPattern(pattern: GradedPattern, size: string, description: string): LandmarkTemplate {
  return {
    size,
    description,
    landmarks(view) {
      const piece = pieceOf(pattern, size, view);
      const frame = piece && (view === "front" || view === "back") ? frameOf(piece, view) : null;
      if (!piece || !frame) return {};
      const wanted = VIEW_ANCHORS[view];
      return Object.fromEntries(
        Object.entries(piece.landmarks)
          .filter(([id]) => (wanted as readonly string[]).includes(id))
          .map(([id, p]) => [id, toUpright(frame, p)]),
      );
    },
  };
}

/** Inverts the same frame: design millimetres to a point on the piece, or null when it falls off the piece (a half piece is mirrored). */
export function mapperFromPattern(pattern: GradedPattern): PieceMapper {
  return {
    toPiece(view, point, size): PieceHit | null {
      const piece = pieceOf(pattern, size, view);
      const frame = piece && (view === "front" || view === "back") ? frameOf(piece, view) : null;
      if (!piece || !frame) return null;
      const [xMm, yMm] = fromUpright(frame, { x: piece.onFold ? Math.abs(point.x) : point.x, y: point.y });
      const inside = pointInPolygon({ x: xMm, y: yMm }, piece.cutOutline.map(([x, y]) => ({ x, y })));
      return inside ? { pieceId: piece.id, xMm: roundMm(xMm), yMm: roundMm(yMm) } : null;
    },
  };
}

export const STAND_IN_SENTENCE =
  "Your garment's own pattern pieces are not connected yet, so the picture was fitted to the benchmark tee pattern. Sizes in millimetres are on that pattern.";

/** The default until W1 and W3 are on main: the benchmark tee, size 48, as measured from its DXF. */
export const STAND_IN_TEMPLATE: LandmarkTemplate = templateFromPattern(TEE_EU48, "48", STAND_IN_SENTENCE);
export const STAND_IN_MAPPER: PieceMapper = mapperFromPattern(TEE_EU48);
